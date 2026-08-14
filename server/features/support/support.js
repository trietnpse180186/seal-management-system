const express = require('express');
const mongoose = require('mongoose');
const { authenticateToken } = require('../auth/authMiddleware');

const router = express.Router();
const SupportRequest = mongoose.model('SupportRequest');
const EventRole = mongoose.model('EventRole');
const User = mongoose.model('User');
const Notification = mongoose.model('Notification');
const TeamMember = mongoose.model('TeamMember');
const Team = mongoose.model('Team');
const { sendSupportReplyEmail } = require('../notifications/emailService');
const guestRequestTimes = new Map();

const coordinatorFilter = (userId) => ({ userId, role: 'admin_view', status: 'active' });

async function isCoordinator(user) {
  if (user.isSystemAdmin) return true;
  return !!(await EventRole.exists(coordinatorFilter(user._id)));
}

async function coordinatorUserIds() {
  const [roles, systemAdmins] = await Promise.all([
    EventRole.find({ role: 'admin_view', status: 'active' }).distinct('userId'),
    User.find({ isSystemAdmin: true, isActive: true }).distinct('_id')
  ]);
  return [...new Set([...roles, ...systemAdmins].map(String))];
}

async function canAccess(request, user) {
  if (request.requesterId?.toString() === user._id.toString()) return true;
  return isCoordinator(user);
}

async function emailGuest(request, message = '', statusLabel = '') {
  if (!request.guestEmail) return;
  try {
    await sendSupportReplyEmail(request.guestEmail, request.guestName, request.requestCode, request.title, message, statusLabel);
  } catch (error) {
    console.error('[SUPPORT] Guest email failed:', error.message);
  }
}

async function resolveUserTeamAndEvent(userId) {
  if (!userId) return { team: null, event: null };
  try {
    const member = await TeamMember.findOne({
      userId,
      confirmStatus: { $in: ['confirmed', 'pending'] }
    })
      .sort({ confirmStatus: 1, createdAt: -1 })
      .populate('teamId', 'name')
      .populate('eventId', 'name');

    if (member?.teamId) {
      return {
        team: member.teamId,
        event: member.eventId
      };
    }

    const leaderTeam = await Team.findOne({ leaderId: userId })
      .sort({ createdAt: -1 })
      .populate('eventId', 'name');

    if (leaderTeam) {
      return {
        team: { _id: leaderTeam._id, name: leaderTeam.name },
        event: leaderTeam.eventId
      };
    }
  } catch (err) {
    console.error('[SUPPORT] Error resolving user team/event:', err.message);
  }
  return { team: null, event: null };
}

async function populateMissingTeamInfo(requests) {
  if (!requests) return requests;
  const isArray = Array.isArray(requests);
  const list = isArray ? requests : [requests];

  const needsLookup = list.filter((r) => (!r.teamId || !r.teamId.name) && r.requesterId);
  if (!needsLookup.length) return requests;

  const requesterIds = [...new Set(needsLookup.map((r) => {
    const id = r.requesterId?._id || r.requesterId;
    return id ? id.toString() : null;
  }).filter(Boolean))];

  if (!requesterIds.length) return requests;

  try {
    const [memberships, leaderTeams] = await Promise.all([
      TeamMember.find({
        userId: { $in: requesterIds },
        confirmStatus: { $in: ['confirmed', 'pending'] }
      })
        .populate('teamId', 'name')
        .populate('eventId', 'name')
        .sort({ confirmStatus: 1, createdAt: -1 }),
      Team.find({
        leaderId: { $in: requesterIds }
      })
        .populate('eventId', 'name')
        .sort({ createdAt: -1 })
    ]);

    const userTeamMap = new Map();

    for (const m of memberships) {
      const uid = m.userId?.toString();
      if (uid && m.teamId && !userTeamMap.has(uid)) {
        userTeamMap.set(uid, {
          teamId: { _id: m.teamId._id, name: m.teamId.name },
          eventId: m.eventId ? { _id: m.eventId._id, name: m.eventId.name } : null
        });
      }
    }

    for (const t of leaderTeams) {
      const uid = t.leaderId?.toString();
      if (uid && !userTeamMap.has(uid)) {
        userTeamMap.set(uid, {
          teamId: { _id: t._id, name: t.name },
          eventId: t.eventId ? { _id: t.eventId._id, name: t.eventId.name } : null
        });
      }
    }

    const enriched = list.map((item) => {
      const obj = item.toObject ? item.toObject() : { ...item };
      if (!obj.teamId || !obj.teamId.name) {
        const uid = (obj.requesterId?._id || obj.requesterId)?.toString();
        if (uid && userTeamMap.has(uid)) {
          const info = userTeamMap.get(uid);
          if (!obj.teamId) obj.teamId = info.teamId;
          if (!obj.eventId && info.eventId) obj.eventId = info.eventId;
        }
      }
      return obj;
    });

    return isArray ? enriched : enriched[0];
  } catch (err) {
    console.error('[SUPPORT] Error populating team info:', err.message);
    return requests;
  }
}

router.post('/guest/requests', async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const recent = (guestRequestTimes.get(ip) || []).filter((time) => now - time < 60 * 60 * 1000);
    if (recent.length >= 5) return res.status(429).json({ message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.' });
    const { name, email, category, title, description } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!String(name || '').trim()) return res.status(400).json({ message: 'Vui lòng nhập họ tên.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return res.status(400).json({ message: 'Email không hợp lệ.' });
    const request = await SupportRequest.create({ guestName: String(name).trim(), guestEmail: normalizedEmail, category, title, description, statusHistory: [] });
    recent.push(now); guestRequestTimes.set(ip, recent);
    const coordinators = await coordinatorUserIds();
    await notifyUsers(coordinators, { type: 'support_request', title: 'Yêu cầu hỗ trợ mới từ khách', body: `${request.requestCode}: ${request.title}`, metadata: { supportRequestId: request._id } });
    emitSupportUpdate(coordinators, request, 'created');
    res.status(201).json({ requestCode: request.requestCode, message: 'Đã gửi yêu cầu hỗ trợ.' });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Không thể tạo yêu cầu hỗ trợ.' });
  }
});

async function notifyUsers(userIds, data) {
  const uniqueIds = [...new Set(userIds.map(String))];
  if (!uniqueIds.length) return;
  await Notification.insertMany(uniqueIds.map((userId) => ({
    userId, channel: 'in_app', status: 'queued', isRead: false, ...data
  })));
}

function emitSupportUpdate(userIds, request, action) {
  try {
    const io = require('../chat/socket').getIO();
    [...new Set(userIds.map(String))].forEach((userId) => {
      io.to(`user:${userId}`).emit('support_updated', {
        action,
        requestId: request._id,
        status: request.status,
        updatedAt: request.updatedAt
      });
    });
  } catch (error) {
    console.error('[SUPPORT] Socket update failed:', error.message);
  }
}

router.post('/requests', authenticateToken, async (req, res) => {
  try {
    const { category, title, description } = req.body;
    let { eventId, teamId } = req.body;

    if (!teamId || !eventId) {
      const resolved = await resolveUserTeamAndEvent(req.user._id);
      if (!teamId && resolved.team) teamId = resolved.team._id;
      if (!eventId && resolved.event) eventId = resolved.event._id || resolved.event;
    }

    const request = await SupportRequest.create({
      requesterId: req.user._id,
      eventId: eventId || null,
      teamId: teamId || null,
      category,
      title,
      description,
      statusHistory: [{ to: 'pending', changedBy: req.user._id }]
    });
    const coordinators = await coordinatorUserIds();
    await notifyUsers(coordinators, {
      type: 'support_request', title: 'Yêu cầu hỗ trợ mới', body: `${request.requestCode}: ${request.title}`,
      metadata: { supportRequestId: request._id }
    });
    emitSupportUpdate(coordinators, request, 'created');
    const populated = await populateMissingTeamInfo(request);
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Không thể tạo yêu cầu hỗ trợ.' });
  }
});

router.get('/requests/my', authenticateToken, async (req, res) => {
  const requests = await SupportRequest.find({ requesterId: req.user._id })
    .populate('requesterId', 'fullName email').populate('teamId', 'name').populate('eventId', 'name').sort({ updatedAt: -1 });
  const result = await populateMissingTeamInfo(requests);
  res.json(result);
});

router.get('/coordinator/requests', authenticateToken, async (req, res) => {
  if (!(await isCoordinator(req.user))) return res.status(403).json({ message: 'Chỉ Coordinator được xem yêu cầu hỗ trợ.' });
  const filter = {};
  if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
  const requests = await SupportRequest.find(filter).populate('requesterId', 'fullName email')
    .populate('teamId', 'name').populate('eventId', 'name').sort({ updatedAt: -1 });
  const result = await populateMissingTeamInfo(requests);
  res.json(result);
});

router.get('/requests/:id', authenticateToken, async (req, res) => {
  const request = await SupportRequest.findById(req.params.id).populate('requesterId', 'fullName email')
    .populate('teamId', 'name').populate('eventId', 'name').populate('replies.senderId', 'fullName email');
  if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu.' });
  if (!(await canAccess(request, req.user))) return res.status(403).json({ message: 'Bạn không có quyền xem yêu cầu này.' });
  const result = await populateMissingTeamInfo(request);
  res.json(result);
});

router.post('/requests/:id/replies', authenticateToken, async (req, res) => {
  const content = String(req.body.content || '').trim();
  const sendEmail = req.body.sendEmail === true;
  if (!content) return res.status(400).json({ message: 'Nội dung phản hồi không được để trống.' });
  const request = await SupportRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu.' });
  if (!(await canAccess(request, req.user))) return res.status(403).json({ message: 'Bạn không có quyền phản hồi.' });
  const coordinator = await isCoordinator(req.user);
  const participant = request.requesterId?.toString() === req.user._id.toString();
  if (!coordinator && !participant) return res.status(403).json({ message: 'Bạn không có quyền phản hồi.' });
  request.replies.push({ senderId: req.user._id, senderName: req.user.fullName, senderRole: coordinator ? 'coordinator' : 'participant', content });
  if (coordinator && ['pending', 'reopened'].includes(request.status)) {
    request.statusHistory.push({ from: request.status, to: 'processing', changedBy: req.user._id });
    request.status = 'processing';
  } else if (!coordinator && request.status === 'waiting_for_candidate') {
    request.statusHistory.push({ from: request.status, to: 'processing', changedBy: req.user._id });
    request.status = 'processing';
  }
  await request.save();

  const labels = { pending: 'Chờ xử lý', processing: 'Đang xử lý', waiting_for_candidate: 'Chờ thí sinh', resolved: 'Đã giải quyết', reopened: 'Đã mở lại', closed: 'Đã đóng' };
  const statusLabel = labels[request.status] || request.status;

  if (coordinator) {
    if (request.requesterId) {
      await notifyUsers([request.requesterId], { type: 'support_reply', title: 'Coordinator đã phản hồi', body: request.title, metadata: { supportRequestId: request._id } });
      emitSupportUpdate([request.requesterId], request, 'replied');
      if (sendEmail) {
        try {
          const requester = await User.findById(request.requesterId, 'fullName email');
          if (requester?.email) {
            await sendSupportReplyEmail(requester.email, requester.fullName, request.requestCode, request.title, content, statusLabel);
          }
        } catch (emailErr) {
          console.error('[SUPPORT] Candidate reply email failed:', emailErr.message);
        }
      }
    } else if (request.guestEmail) {
      if (sendEmail) {
        await emailGuest(request, content, statusLabel);
      }
    }
  } else {
    const coordinators = await coordinatorUserIds();
    await notifyUsers(coordinators, { type: 'support_reply', title: 'Thí sinh đã phản hồi', body: request.title, metadata: { supportRequestId: request._id } });
    emitSupportUpdate(coordinators, request, 'replied');
  }

  const populated = await SupportRequest.findById(request._id)
    .populate('requesterId', 'fullName email')
    .populate('teamId', 'name')
    .populate('eventId', 'name')
    .populate('replies.senderId', 'fullName email');
  const result = await populateMissingTeamInfo(populated);
  res.json(result);
});

router.patch('/requests/:id/status', authenticateToken, async (req, res) => {
  const allowed = ['processing', 'waiting_for_candidate', 'resolved', 'closed'];
  const request = await SupportRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu.' });
  if (!(await isCoordinator(req.user))) return res.status(403).json({ message: 'Chỉ Coordinator được cập nhật trạng thái.' });
  if (!allowed.includes(req.body.status)) return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
  request.statusHistory.push({ from: request.status, to: req.body.status, changedBy: req.user._id });
  request.status = req.body.status;
  if (request.status === 'resolved') { request.resolvedBy = req.user._id; request.resolvedAt = new Date(); }
  if (request.status === 'closed') request.closedAt = new Date();
  await request.save();
  if (request.requesterId) {
    await notifyUsers([request.requesterId], { type: 'support_status', title: 'Yêu cầu hỗ trợ đã cập nhật', body: `${request.requestCode}: ${request.status}`, metadata: { supportRequestId: request._id } });
    emitSupportUpdate([request.requesterId], request, 'status_changed');
  }
  await emailGuest(request, '', request.status);
  const populated = await SupportRequest.findById(request._id)
    .populate('requesterId', 'fullName email')
    .populate('teamId', 'name')
    .populate('eventId', 'name')
    .populate('replies.senderId', 'fullName email');
  const result = await populateMissingTeamInfo(populated);
  res.json(result);
});

router.patch('/requests/:id/reopen', authenticateToken, async (req, res) => {
  const request = await SupportRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu.' });
  const participant = request.requesterId?.toString() === req.user._id.toString();
  if (!participant || !['resolved', 'closed'].includes(request.status)) return res.status(403).json({ message: 'Không thể mở lại yêu cầu này.' });
  request.statusHistory.push({ from: request.status, to: 'reopened', changedBy: req.user._id });
  request.status = 'reopened';
  await request.save();
  const coordinators = await coordinatorUserIds();
  await notifyUsers(coordinators, { type: 'support_status', title: 'Yêu cầu hỗ trợ được mở lại', body: request.title, metadata: { supportRequestId: request._id } });
  emitSupportUpdate(coordinators, request, 'reopened');
  const populated = await SupportRequest.findById(request._id)
    .populate('requesterId', 'fullName email')
    .populate('teamId', 'name')
    .populate('eventId', 'name')
    .populate('replies.senderId', 'fullName email');
  const result = await populateMissingTeamInfo(populated);
  res.json(result);
});

module.exports = router;

