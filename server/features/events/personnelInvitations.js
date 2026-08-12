const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const PersonnelInvitation = mongoose.model('PersonnelInvitation');
const Event = mongoose.model('Event');
const EventRole = mongoose.model('EventRole');
const User = mongoose.model('User');
const Round = mongoose.model('Round');
const Track = mongoose.model('Track');
const { authenticateToken } = require('../auth/authMiddleware');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const escapeRegex = (value) => value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

async function canManagePersonnel(user, eventId) {
  if (user.isSystemAdmin) return true;
  return Boolean(await EventRole.exists({
    userId: user._id,
    eventId,
    role: { $in: ['admin_view', 'student_assistant'] },
    status: 'active',
  }));
}

async function provisionInvitation(invitation, actorId, suppliedPassword = '') {
  if (invitation.status !== 'accepted') throw new Error('Nhân sự chưa chấp thuận lời mời.');

  for (const assignment of invitation.assignments) {
    if (assignment.trackName && assignment.trackName !== 'Chung kết') {
      const trackExists = await Track.exists({
        eventId: invitation.eventId,
        name: new RegExp(`^${escapeRegex(assignment.trackName)}$`, 'i'),
      });
      if (!trackExists) {
        throw new Error(`Track "${assignment.trackName}" không còn tồn tại trong sự kiện.`);
      }
    }
  }

  let user = await User.findOne({ email: invitation.email });
  if (invitation.assignments.some((assignment) => assignment.role === 'judge' && assignment.isChiefJudge)) {
    const chiefJudgeRole = await EventRole.findOne({
      eventId: invitation.eventId,
      role: 'judge',
      isChiefJudge: true,
      status: 'active',
      ...(user ? { userId: { $ne: user._id } } : {}),
    });
    if (chiefJudgeRole) {
      throw new Error('Sự kiện đã có một Chủ tịch Hội đồng khác.');
    }
  }
  const password = String(suppliedPassword || '').trim();
  if (!user) {
    if (password.length < 6) throw new Error('Mật khẩu nhân sự phải có ít nhất 6 ký tự.');
    user = await User.create({
      email: invitation.email,
      fullName: invitation.fullName,
      passwordHash: await bcrypt.hash(password, 10),
      isApproved: true,
      isActive: true,
      authProviders: ['local'],
    });
  } else {
    if (!user.isActive || !user.isApproved) {
      user.isActive = true;
      user.isApproved = true;
    }
    if (password) user.passwordHash = await bcrypt.hash(password, 10);
    user.authProviders = [...new Set([...(user.authProviders || []), 'local'])];
    await user.save();
  }

  for (const assignment of invitation.assignments) {
    let roundId = null;
    let trackId = null;
    if (assignment.roundName && assignment.roundName !== 'Tất cả các vòng') {
      const round = await Round.findOne({
        eventId: invitation.eventId,
        name: new RegExp(`^${escapeRegex(assignment.roundName)}$`, 'i'),
      });
      roundId = round?._id || null;
    }
    if (assignment.trackName) {
      let track = await Track.findOne({
        eventId: invitation.eventId,
        name: new RegExp(`^${escapeRegex(assignment.trackName)}$`, 'i'),
      });
      if (!track && (assignment.trackName.toLowerCase().includes('chung kết') || (roundId && assignment.roundName?.toLowerCase().includes('chung kết')))) {
        track = await Track.findOne({
          eventId: invitation.eventId,
          name: new RegExp(`Bảng Chung Kết|Chung kết`, 'i'),
        });
      }
      if (!track && assignment.trackName !== 'Chung kết' && !assignment.trackName.toLowerCase().includes('chung kết')) {
        throw new Error(`Track "${assignment.trackName}" không còn tồn tại trong sự kiện.`);
      }
      trackId = track?._id || null;
      if (track?.roundId && !roundId) roundId = track.roundId;
    }

    if (!trackId && roundId) {
      const roundTracks = await Track.find({ roundId });
      if (roundTracks.length >= 1) {
        const finalTrack = roundTracks.find((t) => t.name.toLowerCase().includes('chung kết')) || (roundTracks.length === 1 ? roundTracks[0] : null);
        if (finalTrack) trackId = finalTrack._id;
      }
    }

    const roleQuery = {
      userId: user._id,
      eventId: invitation.eventId,
      role: assignment.role,
      trackId,
      roundId,
    };
    const existingRole = await EventRole.findOne(roleQuery);
    if (existingRole) {
      existingRole.status = 'active';
      existingRole.isChiefJudge = assignment.role === 'judge' && Boolean(assignment.isChiefJudge);
      existingRole.assignedBy = actorId;
      existingRole.assignedAt = new Date();
      await existingRole.save();
    } else {
      await EventRole.create({
        ...roleQuery,
        isChiefJudge: assignment.role === 'judge' && Boolean(assignment.isChiefJudge),
        status: 'active',
        assignedBy: actorId,
      });
    }
  }

  invitation.userId = user._id;
  invitation.accountStatus = 'provisioned';
  invitation.provisionedAt = new Date();
  invitation.revokedAt = undefined;
  await invitation.save();

  return invitation;
}

async function revokeInvitation(invitation) {
  if (!invitation.userId) throw new Error('Nhân sự chưa được cấp tài khoản.');
  await EventRole.updateMany(
    {
      userId: invitation.userId,
      eventId: invitation.eventId,
      role: { $in: ['judge', 'mentor'] },
      status: 'active',
    },
    { $set: { status: 'removed' } },
  );
  invitation.accountStatus = 'revoked';
  invitation.revokedAt = new Date();
  await invitation.save();
  return invitation;
}

router.get('/event/:eventId', authenticateToken, async (req, res) => {
  try {
    if (!await canManagePersonnel(req.user, req.params.eventId)) {
      return res.status(403).json({ message: 'Bạn không có quyền quản lý nhân sự.' });
    }
    const invitations = await PersonnelInvitation.find({ eventId: req.params.eventId })
      .select('-tokenHash')
      .sort({ createdAt: -1 })
      .lean();
    res.json(invitations);
  } catch (error) {
    console.error('Fetch Personnel Invitations Error:', error.message);
    res.status(500).json({ message: 'Không thể tải trạng thái lời mời.' });
  }
});

router.delete('/:invitationId', authenticateToken, async (req, res) => {
  try {
    const invitation = await PersonnelInvitation.findById(req.params.invitationId);
    if (!invitation) return res.status(404).json({ message: 'Không tìm thấy lời mời.' });
    if (!await canManagePersonnel(req.user, invitation.eventId)) {
      return res.status(403).json({ message: 'Bạn không có quyền xóa lời mời nhân sự.' });
    }
    if (!['pending', 'rejected'].includes(invitation.status)) {
      return res.status(409).json({ message: 'Không thể xóa lời mời đã được chấp thuận.' });
    }
    await invitation.deleteOne();
    res.json({ message: `Đã xóa lời mời của ${invitation.fullName}.` });
  } catch (error) {
    console.error('Delete Personnel Invitation Error:', error.message);
    res.status(500).json({ message: 'Không thể xóa lời mời nhân sự.' });
  }
});

router.post('/event/:eventId/import', authenticateToken, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Không tìm thấy sự kiện.' });
    const PERSONNEL_ALLOWED = ['draft', 'registration', 'prepare', 'ongoing'];
    if (!PERSONNEL_ALLOWED.includes(event.status) || event.isArchived) {
      return res.status(409).json({ message: 'Chỉ nhập nhân sự cho sự kiện đang trong giai đoạn hoạt động.' });
    }
    if (!await canManagePersonnel(req.user, event._id)) {
      return res.status(403).json({ message: 'Bạn không có quyền nhập danh sách nhân sự.' });
    }

    const personnel = Array.isArray(req.body.personnel) ? req.body.personnel : [];
    if (!personnel.length) return res.status(400).json({ message: 'Danh sách nhân sự trống.' });

    const chiefJudgeEmails = [...new Set(personnel
      .filter((row) => String(row.role || '').toLowerCase() === 'judge' && row.isChiefJudge === true)
      .map((row) => String(row.email || '').trim().toLowerCase()))];
    if (chiefJudgeEmails.length > 1) {
      return res.status(422).json({ message: 'Mỗi sự kiện chỉ được chọn một Chủ tịch Hội đồng.' });
    }
    if (chiefJudgeEmails.length === 1) {
      const [chiefJudgeEmail] = chiefJudgeEmails;
      const existingChiefInvitation = await PersonnelInvitation.findOne({
        eventId: event._id,
        email: { $ne: chiefJudgeEmail },
        status: { $in: ['pending', 'accepted'] },
        assignments: { $elemMatch: { role: 'judge', isChiefJudge: true } },
      });
      const existingChiefRole = await EventRole.findOne({
        eventId: event._id,
        role: 'judge',
        isChiefJudge: true,
        status: 'active',
      }).populate('userId', 'email');
      if (existingChiefInvitation || (existingChiefRole && existingChiefRole.userId?.email !== chiefJudgeEmail)) {
        return res.status(409).json({ message: 'Sự kiện đã có một Chủ tịch Hội đồng khác.' });
      }
    }

    const normalizeName = (value) => String(value || '').trim().normalize('NFC').toLocaleLowerCase('vi-VN');
    const eventTracks = await Track.find({ eventId: event._id }).select('name').lean();
    const availableTrackNames = new Set(eventTracks.map((track) => normalizeName(track.name)));
    const missingTrackNames = [...new Set(
      personnel
        .map((row) => String(row.trackName || '').trim())
        .filter((trackName) => trackName && normalizeName(trackName) !== normalizeName('Chung kết'))
        .filter((trackName) => !availableTrackNames.has(normalizeName(trackName))),
    )];
    if (missingTrackNames.length > 0) {
      return res.status(422).json({
        message: `Không thể nhập nhân sự. Track không tồn tại trong sự kiện: ${missingTrackNames.join(', ')}.`,
        missingTracks: missingTrackNames,
      });
    }

    const grouped = new Map();
    for (const row of personnel) {
      const email = String(row.email || '').trim().toLowerCase();
      const role = String(row.role || '').toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['judge', 'mentor'].includes(role)) {
        return res.status(400).json({ message: `Dữ liệu không hợp lệ tại email ${email || '(trống)'}.` });
      }
      if (String(row.password || '').trim().length < 6) {
        return res.status(400).json({ message: `Mật khẩu của ${email} phải có ít nhất 6 ký tự.` });
      }
      if (!grouped.has(email)) grouped.set(email, {
        email,
        password: String(row.password || '').trim(),
        fullName: String(row.fullName || email.split('@')[0]).trim(),
        unit: String(row.unit || '').trim(),
        assignments: [],
      });
      grouped.get(email).assignments.push({
        role,
        isChiefJudge: role === 'judge' && Boolean(row.isChiefJudge),
        roundName: String(row.roundName || '').trim(),
        trackName: String(row.trackName || '').trim(),
        note: String(row.note || '').trim(),
      });
    }

    const results = [];
    for (const person of grouped.values()) {
      const existing = await PersonnelInvitation.findOne({ eventId: event._id, email: person.email });
      if (existing) {
        results.push({ email: person.email, status: existing.status, skipped: true });
        continue;
      }

      const rawToken = crypto.randomBytes(32).toString('hex');
      const invitation = await PersonnelInvitation.findOneAndUpdate(
        { eventId: event._id, email: person.email },
        {
          $set: {
            email: person.email,
            fullName: person.fullName,
            unit: person.unit,
            assignments: person.assignments,
            status: 'accepted',
            tokenHash: hashToken(rawToken),
            tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            invitedBy: req.user._id,
            invitedAt: new Date(),
          },
          $unset: { respondedAt: 1, emailStatus: 1, emailError: 1 },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      await provisionInvitation(invitation, req.user._id, person.password);
      results.push({ email: person.email, status: invitation.status, accountStatus: invitation.accountStatus });
    }

    res.json({ message: `Đã nhập ${results.length} nhân sự.`, results });
  } catch (error) {
    console.error('Import Personnel Error:', error.message);
    res.status(500).json({ message: 'Không thể nhập danh sách nhân sự.' });
  }
});

router.post('/:invitationId/provision', authenticateToken, async (req, res) => {
  try {
    const invitation = await PersonnelInvitation.findById(req.params.invitationId);
    if (!invitation) return res.status(404).json({ message: 'Không tìm thấy lời mời.' });
    if (!await canManagePersonnel(req.user, invitation.eventId)) {
      return res.status(403).json({ message: 'Bạn không có quyền cấp tài khoản.' });
    }
    await provisionInvitation(invitation, req.user._id, req.body.password);
    res.json({ message: `Đã cấp tài khoản cho ${invitation.fullName}.` });
  } catch (error) {
    console.error('Provision Personnel Error:', error.message);
    res.status(400).json({ message: error.message || 'Không thể cấp tài khoản.' });
  }
});

router.put('/:invitationId/details', authenticateToken, async (req, res) => {
  try {
    const invitation = await PersonnelInvitation.findById(req.params.invitationId);
    if (!invitation) return res.status(404).json({ message: 'Không tìm thấy nhân sự.' });
    if (!await canManagePersonnel(req.user, invitation.eventId)) {
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa nhân sự.' });
    }

    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '').trim();
    const assignments = Array.isArray(req.body.assignments) ? req.body.assignments : [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Tài khoản email không hợp lệ.' });
    }
    if (password && password.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }
    if (!assignments.length || assignments.some((item) => !['judge', 'mentor'].includes(item.role))) {
      return res.status(400).json({ message: 'Nhân sự phải có ít nhất một vai trò hợp lệ.' });
    }

    const duplicateInvitation = await PersonnelInvitation.exists({
      _id: { $ne: invitation._id },
      eventId: invitation.eventId,
      email,
    });
    const duplicateUser = await User.exists({
      ...(invitation.userId ? { _id: { $ne: invitation.userId } } : {}),
      email,
    });
    if (duplicateInvitation || duplicateUser) {
      return res.status(409).json({ message: 'Email này đã thuộc về một nhân sự khác.' });
    }

    if (invitation.userId) {
      const user = await User.findById(invitation.userId);
      if (user) {
        user.email = email;
        user.fullName = invitation.fullName;
        user.isApproved = true;
        user.isActive = true;
        user.authProviders = [...new Set([...(user.authProviders || []), 'local'])];
        if (password) user.passwordHash = await bcrypt.hash(password, 10);
        await user.save();
        await EventRole.updateMany(
          { userId: user._id, eventId: invitation.eventId, role: { $in: ['judge', 'mentor'] } },
          { $set: { status: 'removed' } },
        );
      }
    }

    invitation.email = email;
    invitation.assignments = assignments.map((item) => ({
      role: item.role,
      isChiefJudge: item.role === 'judge' && Boolean(item.isChiefJudge),
      roundName: String(item.roundName || '').trim(),
      trackName: String(item.trackName || '').trim(),
      note: String(item.note || '').trim(),
    }));
    invitation.status = 'accepted';
    await invitation.save();
    await provisionInvitation(invitation, req.user._id, password);

    res.json({ message: `Đã cập nhật thông tin của ${invitation.fullName}.` });
  } catch (error) {
    console.error('Update Personnel Details Error:', error.message);
    res.status(400).json({ message: error.message || 'Không thể cập nhật nhân sự.' });
  }
});

router.put('/:invitationId/mentor-track', authenticateToken, async (req, res) => {
  try {
    const invitation = await PersonnelInvitation.findById(req.params.invitationId);
    if (!invitation) return res.status(404).json({ message: 'Không tìm thấy lời mời.' });
    if (!await canManagePersonnel(req.user, invitation.eventId)) {
      return res.status(403).json({ message: 'Bạn không có quyền cập nhật phân công Mentor.' });
    }
    if (!invitation.assignments.some((assignment) => assignment.role === 'mentor')) {
      return res.status(400).json({ message: 'Lời mời này không có vai trò Mentor.' });
    }

    const track = await Track.findOne({
      _id: req.body.trackId,
      eventId: invitation.eventId,
    }).populate('roundId', 'name status');
    if (!track) return res.status(404).json({ message: 'Track không thuộc sự kiện đang quản lý.' });
    if (track.roundId?.status !== 'active') {
      return res.status(409).json({ message: 'Chỉ có thể phân Mentor vào track của vòng đang hoạt động.' });
    }

    invitation.assignments.forEach((assignment) => {
      if (assignment.role === 'mentor') {
        assignment.trackName = track.name;
        assignment.roundName = track.roundId.name;
      }
    });

    if (invitation.accountStatus === 'provisioned' && invitation.userId) {
      await EventRole.updateMany(
        { userId: invitation.userId, eventId: invitation.eventId, role: 'mentor', status: 'active' },
        { $set: { status: 'removed' } },
      );
      await EventRole.findOneAndUpdate(
        {
          userId: invitation.userId,
          eventId: invitation.eventId,
          role: 'mentor',
          trackId: track._id,
          roundId: track.roundId._id,
        },
        { $set: { status: 'active', assignedBy: req.user._id, assignedAt: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    await invitation.save();
    res.json({ message: `Đã phân công Mentor vào ${track.name}.`, trackName: track.name });
  } catch (error) {
    console.error('Update Mentor Track Error:', error.message);
    res.status(500).json({ message: 'Không thể cập nhật track cho Mentor.' });
  }
});

router.put('/:invitationId/assignment-track', authenticateToken, async (req, res) => {
  try {
    const { assignmentIndex, trackId } = req.body;
    const invitation = await PersonnelInvitation.findById(req.params.invitationId);
    if (!invitation) return res.status(404).json({ message: 'Không tìm thấy lời mời.' });
    if (!await canManagePersonnel(req.user, invitation.eventId)) {
      return res.status(403).json({ message: 'Bạn không có quyền cập nhật phân công nhân sự.' });
    }
    if (typeof assignmentIndex !== 'number' || assignmentIndex < 0 || assignmentIndex >= invitation.assignments.length) {
      return res.status(400).json({ message: 'Vị trí phân công không hợp lệ.' });
    }

    const track = await Track.findOne({
      _id: trackId,
      eventId: invitation.eventId,
    }).populate('roundId', 'name status');
    if (!track) return res.status(404).json({ message: 'Track không thuộc sự kiện đang quản lý.' });

    const targetAssignment = invitation.assignments[assignmentIndex];
    const oldTrackName = targetAssignment.trackName;
    targetAssignment.trackName = track.name;
    if (track.roundId) {
      targetAssignment.roundName = track.roundId.name;
    }
    invitation.markModified('assignments');
    await invitation.save();

    if (invitation.accountStatus === 'provisioned' && invitation.userId) {
      const oldTrack = await Track.findOne({ name: oldTrackName, eventId: invitation.eventId });
      if (oldTrack) {
        await EventRole.findOneAndUpdate(
          {
            userId: invitation.userId,
            eventId: invitation.eventId,
            role: targetAssignment.role,
            trackId: oldTrack._id,
          },
          {
            $set: {
              trackId: track._id,
              roundId: track.roundId?._id || track.roundId,
              status: 'active',
              assignedBy: req.user._id,
              assignedAt: new Date(),
            },
          },
        );
      } else {
        await EventRole.findOneAndUpdate(
          {
            userId: invitation.userId,
            eventId: invitation.eventId,
            role: targetAssignment.role,
            trackId: null,
            roundId: null,
          },
          {
            $set: {
              trackId: track._id,
              roundId: track.roundId?._id || track.roundId,
              status: 'active',
              assignedBy: req.user._id,
              assignedAt: new Date(),
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
      }
    }

    res.json({
      message: `Đã cập nhật track cho ${targetAssignment.role === 'judge' ? 'Giám khảo' : 'Mentor'} (${track.name}).`,
      trackName: track.name,
    });
  } catch (error) {
    console.error('Update assignment track error:', error.message);
    res.status(500).json({ message: 'Không thể cập nhật track cho phân công.' });
  }
});

router.put('/:invitationId/chief-judge', authenticateToken, async (req, res) => {
  try {
    const invitation = await PersonnelInvitation.findById(req.params.invitationId);
    if (!invitation) return res.status(404).json({ message: 'Không tìm thấy lời mời.' });
    if (!await canManagePersonnel(req.user, invitation.eventId)) {
      return res.status(403).json({ message: 'Bạn không có quyền phân công Chủ tịch Hội đồng.' });
    }
    if (!invitation.assignments.some((assignment) => assignment.role === 'judge')) {
      return res.status(400).json({ message: 'Tài khoản này không có vai trò Giám khảo.' });
    }
    const conflictingInvitation = await PersonnelInvitation.findOne({
      _id: { $ne: invitation._id },
      eventId: invitation.eventId,
      status: { $in: ['pending', 'accepted'] },
      assignments: { $elemMatch: { role: 'judge', isChiefJudge: true } },
    });
    const conflictingRole = await EventRole.findOne({
      eventId: invitation.eventId,
      role: 'judge',
      isChiefJudge: true,
      status: 'active',
      ...(invitation.userId ? { userId: { $ne: invitation.userId } } : {}),
    });
    if (conflictingInvitation || conflictingRole) {
      return res.status(409).json({ message: 'Sự kiện đã có một Chủ tịch Hội đồng khác.' });
    }

    invitation.assignments.forEach((assignment) => {
      if (assignment.role === 'judge') assignment.isChiefJudge = true;
    });
    await invitation.save();
    if (invitation.userId) {
      await EventRole.updateMany(
        { userId: invitation.userId, eventId: invitation.eventId, role: 'judge', status: 'active' },
        { $set: { isChiefJudge: true, assignedBy: req.user._id, assignedAt: new Date() } },
      );
    }
    res.json({ message: `Đã phân công ${invitation.fullName} làm Chủ tịch Hội đồng.` });
  } catch (error) {
    console.error('Assign Chief Judge Error:', error.message);
    res.status(500).json({ message: 'Không thể phân công Chủ tịch Hội đồng.' });
  }
});

router.post('/event/:eventId/provision-all', authenticateToken, async (req, res) => {
  try {
    if (!await canManagePersonnel(req.user, req.params.eventId)) {
      return res.status(403).json({ message: 'Bạn không có quyền cấp tài khoản.' });
    }
    const invitations = await PersonnelInvitation.find({
      eventId: req.params.eventId,
      status: 'accepted',
      accountStatus: { $ne: 'provisioned' },
    });
    const errors = [];
    let provisioned = 0;
    for (const invitation of invitations) {
      try {
        await provisionInvitation(invitation, req.user._id);
        provisioned += 1;
      } catch (error) {
        errors.push(`${invitation.email}: ${error.message}`);
      }
    }
    res.json({ message: `Đã cấp ${provisioned} tài khoản.`, provisioned, errors });
  } catch (error) {
    res.status(500).json({ message: 'Không thể cấp tài khoản hàng loạt.' });
  }
});

router.post('/:invitationId/revoke', authenticateToken, async (req, res) => {
  try {
    const invitation = await PersonnelInvitation.findById(req.params.invitationId);
    if (!invitation) return res.status(404).json({ message: 'Không tìm thấy nhân sự.' });
    if (!await canManagePersonnel(req.user, invitation.eventId)) {
      return res.status(403).json({ message: 'Bạn không có quyền thu hồi.' });
    }
    await revokeInvitation(invitation);
    res.json({ message: `Đã thu hồi quyền của ${invitation.fullName}.` });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Không thể thu hồi quyền.' });
  }
});

router.post('/event/:eventId/revoke-all', authenticateToken, async (req, res) => {
  try {
    if (!await canManagePersonnel(req.user, req.params.eventId)) {
      return res.status(403).json({ message: 'Bạn không có quyền thu hồi.' });
    }
    const invitations = await PersonnelInvitation.find({
      eventId: req.params.eventId,
      accountStatus: 'provisioned',
    });
    let revoked = 0;
    for (const invitation of invitations) {
      await revokeInvitation(invitation);
      revoked += 1;
    }
    res.json({ message: `Đã thu hồi quyền của ${revoked} nhân sự.`, revoked });
  } catch (error) {
    res.status(500).json({ message: 'Không thể thu hồi quyền hàng loạt.' });
  }
});

router.get('/respond/:token', async (req, res) => {
  try {
    const invitation = await PersonnelInvitation.findOne({ tokenHash: hashToken(req.params.token) })
      .populate('eventId', 'name status');
    if (!invitation || invitation.tokenExpiresAt < new Date()) {
      return res.status(404).json({ message: 'Lời mời không hợp lệ hoặc đã hết hạn.' });
    }
    res.json({
      fullName: invitation.fullName,
      email: invitation.email,
      eventName: invitation.eventId?.name,
      assignments: invitation.assignments,
      status: invitation.status,
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể đọc lời mời.' });
  }
});

router.post('/respond/:token', async (req, res) => {
  try {
    const decision = req.body.decision;
    if (!['accepted', 'rejected'].includes(decision)) {
      return res.status(400).json({ message: 'Phản hồi không hợp lệ.' });
    }
    const invitation = await PersonnelInvitation.findOne({ tokenHash: hashToken(req.params.token) });
    if (!invitation || invitation.tokenExpiresAt < new Date()) {
      return res.status(404).json({ message: 'Lời mời không hợp lệ hoặc đã hết hạn.' });
    }
    if (invitation.status !== 'pending') {
      return res.json({ message: 'Lời mời này đã được phản hồi.', status: invitation.status });
    }
    invitation.status = decision;
    invitation.respondedAt = new Date();
    await invitation.save();
    res.json({
      message: decision === 'accepted' ? 'Bạn đã chấp thuận lời mời.' : 'Bạn đã từ chối lời mời.',
      status: decision,
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể lưu phản hồi lời mời.' });
  }
});

module.exports = router;
