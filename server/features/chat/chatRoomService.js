const mongoose = require('mongoose');

async function ensureChatRoomForTeam(team) {
  const ChatRoom = mongoose.model('ChatRoom');
  const TeamMember = mongoose.model('TeamMember');

  // Tìm tất cả các thành viên đã xác nhận của đội
  const teamMembers = await TeamMember.find({ teamId: team._id, confirmStatus: 'confirmed' });
  const memberIds = teamMembers.map(tm => tm.userId);

  // Tìm phòng chat chung của đội thi với mentor
  let room = await ChatRoom.findOne({ teamId: team._id, type: 'team_mentor' });
  if (!room) {
    room = new ChatRoom({
      teamId: team._id,
      trackId: team.trackId,
      eventId: team.eventId,
      type: 'team_mentor',
      members: memberIds,
      mentorId: team.mentorId || undefined
    });
    await room.save();
    console.log(`[CHAT] Created general team_mentor room for team ${team.name}`);
  } else {
    // Đảm bảo tất cả thành viên hiện tại đều có mặt trong thành viên phòng
    let updated = false;
    if (team.mentorId && (!room.mentorId || room.mentorId.toString() !== team.mentorId.toString())) {
      room.mentorId = team.mentorId;
      updated = true;
    }
    const currentMemberIds = room.members.map(id => id.toString());
    const newMembers = memberIds.filter(id => !currentMemberIds.includes(id.toString()));
    if (newMembers.length > 0) {
      room.members.push(...newMembers);
      updated = true;
    }
    if (updated) {
      await room.save();
    }
  }
  return room;
}

async function ensureChatRoomsForMentorTrack(mentorUserId, trackId, eventId) {
  const Team = mongoose.model('Team');
  // Find all confirmed teams in this track
  const teams = await Team.find({ trackId, status: 'confirmed' });
  for (const team of teams) {
    await ensureChatRoomForTeam(team);
  }
}

async function ensureTrackMentorChatRoom(trackId, eventId) {
  const ChatRoom = mongoose.model('ChatRoom');
  const EventRole = mongoose.model('EventRole');

  if (!trackId || !eventId) return;

  // Find all mentors in this track
  const mentors = await EventRole.find({
    eventId,
    trackId,
    role: 'mentor',
    status: 'active'
  });
  const mentorUserIds = mentors.map(m => m.userId);

  if (mentorUserIds.length === 0) return;

  // Check if track mentors chat room already exists
  let room = await ChatRoom.findOne({ trackId, type: 'track_mentors' });
  if (!room) {
    room = new ChatRoom({
      trackId,
      eventId,
      type: 'track_mentors',
      members: mentorUserIds
    });
    await room.save();
    console.log(`[CHAT] Created track mentors room for track ${trackId}`);
  } else {
    // Update members to include all current mentors
    const allMembers = Array.from(new Set([...room.members.map(id => id.toString()), ...mentorUserIds.map(id => id.toString())]));
    room.members = allMembers;
    await room.save();
    console.log(`[CHAT] Updated track mentors room members for track ${trackId}`);
  }
}

async function ensureEventGeneralChatRoom(eventId) {
  const ChatRoom = mongoose.model('ChatRoom');
  let room = await ChatRoom.findOne({ eventId, type: 'event_general' });
  if (!room) {
    room = new ChatRoom({
      eventId,
      type: 'event_general',
      members: []
    });
    await room.save();
    console.log(`[CHAT] Created event_general room for event ${eventId}`);
  }
  return room;
}

const ENDED_EVENT_STATUSES = ['completed', 'cancelled'];

function normalizeEventId(eventId) {
  return eventId?._id ? eventId._id : eventId;
}

async function isEventChatClosed(eventId) {
  const Event = mongoose.model('Event');
  const id = normalizeEventId(eventId);
  const event = await Event.findById(id).select('status').lean();
  return !event || ENDED_EVENT_STATUSES.includes(event.status);
}

async function isCoordinatorForEvent(userId, eventId) {
  const EventRole = mongoose.model('EventRole');
  const id = normalizeEventId(eventId);
  const role = await EventRole.findOne({
    userId,
    eventId: id,
    role: 'coordinator',
    status: 'active'
  });
  return !!role;
}

async function canViewEndedEventChat(userId, eventId, isSystemAdmin = false) {
  if (isSystemAdmin) return true;
  return isCoordinatorForEvent(userId, eventId);
}

function isRoomVisibleToUser(room, { isSystemAdmin = false, coordinatorEventIds = [] } = {}) {
  const eventStatus = room.eventId?.status;
  const eventId = normalizeEventId(room.eventId)?.toString();
  if (!ENDED_EVENT_STATUSES.includes(eventStatus)) {
    return eventStatus === 'ongoing';
  }
  return isSystemAdmin || coordinatorEventIds.includes(eventId);
}

async function checkRoomAccess(room, userId, options = {}) {
  const { isSystemAdmin = false, requireWrite = false } = options;
  const EventRole = mongoose.model('EventRole');
  const TeamMember = mongoose.model('TeamMember');
  const Team = mongoose.model('Team');

  if (!room?.eventId) return false;

  const eventId = normalizeEventId(room.eventId);

  // System Admin and Event Coordinators always have access to all rooms in their event
  if (isSystemAdmin) return true;
  const isCoordinator = await isCoordinatorForEvent(userId, eventId);
  if (isCoordinator) return true;

  const chatClosed = await isEventChatClosed(eventId);

  if (chatClosed) {
    const canView = await canViewEndedEventChat(userId, eventId, isSystemAdmin);
    if (!canView) return false;
    return !requireWrite;
  }

  // 1. Nếu là thành viên trực tiếp hoặc mentor được gán
  if (room.members && room.members.some(id => id.toString() === userId.toString())) return true;
  if (room.mentorId && room.mentorId.toString() === userId.toString()) return true;

  // 2. Nếu là phòng chat chung (event_general)
  if (room.type === 'event_general') {
    const isMember = await TeamMember.findOne({ userId }).populate('teamId');
    if (isMember && isMember.teamId && isMember.teamId.eventId.toString() === room.eventId.toString()) {
      return true;
    }
    const hasRole = await EventRole.findOne({ userId, eventId: room.eventId, status: 'active' });
    if (hasRole) return true;
  }

  // 3. Nếu là phòng chat đội thi (team_mentor), cho phép mentor thuộc bảng đó xem
  if (room.type === 'team_mentor') {
    const team = await Team.findById(room.teamId);
    if (team) {
      const isTrackMentor = await EventRole.findOne({
        userId,
        eventId: team.eventId,
        trackId: team.trackId,
        role: 'mentor',
        status: 'active'
      });
      if (isTrackMentor) return true;
    }
  }

  return false;
}

module.exports = {
  ensureChatRoomForTeam,
  ensureChatRoomsForMentorTrack,
  ensureTrackMentorChatRoom,
  ensureEventGeneralChatRoom,
  checkRoomAccess,
  ENDED_EVENT_STATUSES,
  isEventChatClosed,
  canViewEndedEventChat,
  isCoordinatorForEvent,
  isRoomVisibleToUser
};
