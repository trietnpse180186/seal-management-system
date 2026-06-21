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

    // Tự động kiểm tra và đảm bảo các phòng chat của mentor đã được tạo (dynamic self-healing)
    try {
      const EventRole = mongoose.model('EventRole');
      const mentorRoles = await EventRole.find({ userId, role: 'mentor', status: 'active' });
      if (mentorRoles.length > 0) {
        const { ensureTrackMentorChatRoom, ensureChatRoomsForMentorTrack } = require('./chatRoomService');
        for (const role of mentorRoles) {
          if (role.trackId && role.eventId) {
            await ensureTrackMentorChatRoom(role.trackId, role.eventId);
            await ensureChatRoomsForMentorTrack(userId, role.trackId, role.eventId);
          }
        }
      }
    } catch (syncErr) {
      console.error('[CHAT] Dynamic room sync error:', syncErr.message);
    }

    // Tìm tất cả các phòng mà user là thành viên (members) hoặc mentor (mentorId)
    // Thực tế members array đã có chứa mentorId, nhưng cẩn thận query cả 2
    const rooms = await ChatRoom.find({
      $or: [
        { members: userId },
        { mentorId: userId }
      ]
    }).populate('teamId', 'name')
      .populate('trackId', 'name')
      .populate('mentorId', 'fullName email')
      .populate('members', 'fullName role avatar')
      .sort({ updatedAt: -1 });

    res.json(rooms);
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

    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: "Không tìm thấy phòng chat." });
    }

    // Kiểm tra quyền truy cập: user phải nằm trong members hoặc là mentor
    const isMember = room.members.some(id => id.toString() === userId.toString()) || 
                     (room.mentorId && room.mentorId.toString() === userId.toString());
    if (!isMember) {
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

module.exports = router;
