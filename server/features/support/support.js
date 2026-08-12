const express = require('express');
const mongoose = require('mongoose');
const { authenticateToken } = require('../auth/authMiddleware');

const router = express.Router();
const SupportRequest = mongoose.model('SupportRequest');
const EventRole = mongoose.model('EventRole');
const User = mongoose.model('User');
const Notification = mongoose.model('Notification');
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
    const request = await SupportRequest.create({
      requesterId: req.user._id,
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
    res.status(201).json(request);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Không thể tạo yêu cầu hỗ trợ.' });
  }
});

router.get('/requests/my', authenticateToken, async (req, res) => {
  const requests = await SupportRequest.find({ requesterId: req.user._id })
    .populate('requesterId', 'fullName').populate('teamId', 'name').populate('eventId', 'name').sort({ updatedAt: -1 });
  res.json(requests);
});

router.get('/coordinator/requests', authenticateToken, async (req, res) => {
  if (!(await isCoordinator(req.user))) return res.status(403).json({ message: 'Chỉ Coordinator được xem yêu cầu hỗ trợ.' });
  const filter = {};
  if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
  const requests = await SupportRequest.find(filter).populate('requesterId', 'fullName email')
    .populate('teamId', 'name').populate('eventId', 'name').sort({ updatedAt: -1 });
  res.json(requests);
});

router.get('/requests/:id', authenticateToken, async (req, res) => {
  const request = await SupportRequest.findById(req.params.id).populate('requesterId', 'fullName email')
    .populate('teamId', 'name').populate('eventId', 'name').populate('replies.senderId', 'fullName');
  if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu.' });
  if (!(await canAccess(request, req.user))) return res.status(403).json({ message: 'Bạn không có quyền xem yêu cầu này.' });
  res.json(request);
});

router.post('/requests/:id/replies', authenticateToken, async (req, res) => {
  const content = String(req.body.content || '').trim();
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
  if (coordinator) {
    if (request.requesterId) {
      await notifyUsers([request.requesterId], { type: 'support_reply', title: 'Coordinator đã phản hồi', body: request.title, metadata: { supportRequestId: request._id } });
      emitSupportUpdate([request.requesterId], request, 'replied');
    }
    await emailGuest(request, content, 'Đang xử lý');
  } else {
    const coordinators = await coordinatorUserIds();
    await notifyUsers(coordinators, { type: 'support_reply', title: 'Thí sinh đã phản hồi', body: request.title, metadata: { supportRequestId: request._id } });
    emitSupportUpdate(coordinators, request, 'replied');
  }
  res.json(request);
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
  res.json(request);
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
  res.json(request);
});

module.exports = router;
