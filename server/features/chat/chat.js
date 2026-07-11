const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authenticateToken } = require('../auth/authMiddleware');

const ChatRoom = mongoose.model('ChatRoom');
const ChatMessage = mongoose.model('ChatMessage');
const Team = mongoose.model('Team');

// Lấy danh sách các phòng chat của user hiện tại
router.get('/rooms', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const EventRole = mongoose.model('EventRole');
    const TeamMember = mongoose.model('TeamMember');
    const { ensureTrackMentorChatRoom, ensureChatRoomsForMentorTrack, ensureEventGeneralChatRoom, isRoomVisibleToUser } = require('./chatRoomService');
    const isSystemAdmin = !!req.user.isSystemAdmin;

    // 1. Tự động đồng bộ các phòng chat của mentor (dynamic self-healing)
    try {
      const mentorRoles = await EventRole.find({ userId, role: 'mentor', status: 'active' });
      if (mentorRoles.length > 0) {
        for (const role of mentorRoles) {
          if (role.trackId && role.eventId) {
            await ensureTrackMentorChatRoom(role.trackId, role.eventId);
            await ensureChatRoomsForMentorTrack(userId, role.trackId, role.eventId);
            await ensureEventGeneralChatRoom(role.eventId);
          }
        }
      }
    } catch (syncErr) {
      console.error('[CHAT] Dynamic room sync error:', syncErr.message);
    }

    // 2. Tìm các eventId mà user có liên quan
    const associatedEventIds = [];
    
    // A. Thí sinh (qua các đội tham gia)
    const myTeamMemberships = await TeamMember.find({ userId }).populate('teamId');
    for (const tm of myTeamMemberships) {
      if (tm.teamId && tm.teamId.eventId) {
        associatedEventIds.push(tm.teamId.eventId.toString());
      }
    }

    // B. Ban tổ chức / Mentor / Giám khảo (qua EventRole)
    const myRoles = await EventRole.find({ userId, status: 'active' });
    for (const r of myRoles) {
      associatedEventIds.push(r.eventId.toString());
    }

    const uniqueEventIds = Array.from(new Set(associatedEventIds));
    const coordinatorEventIds = myRoles
      .filter(r => r.role === 'coordinator')
      .map(r => r.eventId.toString());

    // 3. Tự động tạo phòng chat tổng cho các event của thí sinh nếu chưa có
    for (const evId of uniqueEventIds) {
      try {
        await ensureEventGeneralChatRoom(evId);
      } catch (err) {
        console.error('[CHAT] Error ensuring general room:', err.message);
      }
    }

    // 4. Truy vấn phòng chat:
    // - Phòng mà user là thành viên hoặc mentor được gán trực tiếp
    // - HOẶC phòng chat tổng (event_general) của các sự kiện mà user tham gia
    // - HOẶC nếu là mentor, các phòng chat của các đội thuộc bảng đấu (track) mà mentor quản lý
    const mentorTrackIds = myRoles.filter(r => r.role === 'mentor' && r.trackId).map(r => r.trackId.toString());

    const orConditions = [
      { members: userId },
      { mentorId: userId },
      { eventId: { $in: uniqueEventIds }, type: 'event_general' },
      { trackId: { $in: mentorTrackIds }, type: 'team_mentor' }
    ];

    if (coordinatorEventIds.length > 0) {
      orConditions.push({ eventId: { $in: coordinatorEventIds } });
    }

    const roomsQuery = isSystemAdmin
      ? ChatRoom.find({})
      : ChatRoom.find({ $or: orConditions });

    const rooms = await roomsQuery
      .populate({
        path: 'teamId',
        select: 'name mentorId',
        populate: {
          path: 'mentorId',
          select: 'fullName email'
        }
      })
      .populate('trackId', 'name')
      .populate('mentorId', 'fullName email')
      .populate('eventId', 'name status')
      .populate('members', 'fullName role avatar')
      .sort({ updatedAt: -1 });

    const visibleRooms = rooms.filter(room => isRoomVisibleToUser(room));

    res.json(visibleRooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi lấy danh sách phòng chat." });
  }
});

// Lấy lịch sử tin nhắn của một phòng chat cụ thể
router.get('/rooms/:roomId/messages', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user._id;
    const { checkRoomAccess } = require('./chatRoomService');

    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: "Không tìm thấy phòng chat." });
    }

    // Kiểm tra quyền truy cập bảo mật qua helper
    const hasAccess = await checkRoomAccess(room, userId, { isSystemAdmin: !!req.user.isSystemAdmin });
    if (!hasAccess) {
      return res.status(403).json({ message: "Bạn không có quyền xem tin nhắn phòng này." });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await ChatMessage.find({ roomId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json(messages.reverse());
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi lấy tin nhắn." });
  }
});

/**
 * @route   GET /api/chat/mentor/teams
 * @desc    Lấy danh sách các đội thi thuộc bảng đấu mà mentor quản lý
 * @access  Private (Mentors)
 */
router.get('/mentor/teams', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const EventRole = mongoose.model('EventRole');
    
    // Tìm các vai trò mentor của user
    const mentorRoles = await EventRole.find({ userId, role: 'mentor', status: 'active' });
    if (mentorRoles.length === 0) {
      return res.json([]);
    }

    const trackIds = mentorRoles.filter(r => r.trackId).map(r => r.trackId);
    
    // Tìm tất cả các đội đã xác nhận thuộc các bảng đấu này
    const TeamMember = mongoose.model('TeamMember');
    const teams = await Team.find({
      trackId: { $in: trackIds },
      status: 'confirmed'
    }).populate('trackId', 'name').populate('eventId', 'status');

    const detailedTeams = await Promise.all(
      teams
        .filter(t => t.eventId?.status === 'ongoing')
        .map(async (t) => {
          const members = await TeamMember.find({ teamId: t._id }).populate('userId', 'fullName email');
          return {
            _id: t._id,
            name: t.name,
            trackName: t.trackId?.name || 'Chưa rõ',
            members: members.map(m => ({
              userId: m.userId?._id,
              fullName: m.userId?.fullName || 'Ẩn danh',
              email: m.userId?.email
            }))
          };
        })
    );

    res.json(detailedTeams);
  } catch (err) {
    console.error('[CHAT] Error fetching mentor teams:', err.message);
    res.status(500).json({ message: 'Lỗi lấy danh sách đội thi của bảng.' });
  }
});

/**
 * @route   POST /api/chat/rooms/team
 * @desc    Tạo hoặc lấy phòng chat riêng giữa Mentor và Đội thi thuộc bảng đấu của họ
 * @access  Private (Mentors)
 */
router.post('/rooms/team', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { teamId } = req.body;

    if (!teamId) {
      return res.status(400).json({ message: 'Thiếu thông tin ID đội thi.' });
    }

    const team = await Team.findById(teamId).populate('eventId', 'status');
    if (!team) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin đội thi.' });
    }

    if (team.eventId?.status !== 'ongoing') {
      return res.status(403).json({ message: 'Cuộc thi đã kết thúc. Không thể mở phòng chat mới.' });
    }

    // Xác thực người dùng là mentor của bảng đấu của đội thi này
    const EventRole = mongoose.model('EventRole');
    const isMentor = await EventRole.findOne({
      userId,
      eventId: team.eventId,
      trackId: team.trackId,
      role: 'mentor',
      status: 'active'
    });

    if (!isMentor) {
      return res.status(403).json({ message: 'Bạn không phải là Mentor phụ trách bảng đấu của đội thi này.' });
    }

    // Tìm hoặc tạo phòng chat
    let room = await ChatRoom.findOne({ teamId: team._id, mentorId: userId });
    if (!room) {
      const TeamMember = mongoose.model('TeamMember');
      const teamMembers = await TeamMember.find({ teamId: team._id, confirmStatus: 'confirmed' });
      const memberIds = teamMembers.map(tm => tm.userId);

      room = new ChatRoom({
        teamId: team._id,
        mentorId: userId,
        eventId: team.eventId,
        trackId: team.trackId,
        type: 'team_mentor',
        members: [...memberIds, userId]
      });
      await room.save();
      console.log(`[CHAT] Created room for team ${team.name} by mentor ${userId}`);
    }

    // Populate thông tin để trả về
    const populatedRoom = await ChatRoom.findById(room._id)
      .populate('teamId', 'name')
      .populate('trackId', 'name')
      .populate('mentorId', 'fullName email')
      .populate('eventId', 'name status')
      .populate('members', 'fullName role avatar');

    res.json(populatedRoom);
  } catch (err) {
    console.error('[CHAT] Error creating team room:', err.message);
    res.status(500).json({ message: 'Lỗi khởi tạo phòng chat riêng với đội thi.' });
  }
});

module.exports = router;
