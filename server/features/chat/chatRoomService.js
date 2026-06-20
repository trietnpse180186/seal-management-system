const mongoose = require('mongoose');

async function ensureChatRoomForTeam(team) {
  const ChatRoom = mongoose.model('ChatRoom');
  const TeamMember = mongoose.model('TeamMember');

  if (!team.mentorId) return;

  // Find all team members
  const teamMembers = await TeamMember.find({ teamId: team._id, confirmStatus: 'confirmed' });
  const memberIds = teamMembers.map(tm => tm.userId);

  // Check if room already exists
  const existingRoom = await ChatRoom.findOne({ teamId: team._id, mentorId: team.mentorId });
  if (!existingRoom) {
    const room = new ChatRoom({
      teamId: team._id,
      mentorId: team.mentorId,
      eventId: team.eventId,
      members: [...memberIds, team.mentorId]
    });
    await room.save();
    console.log(`[CHAT] Created room for team ${team.name} and mentor ${team.mentorId}`);
  } else {
    // Ensure all current members are in the room
    const allMembers = [...memberIds, team.mentorId];
    const newMembers = allMembers.filter(id => !existingRoom.members.includes(id));
    if (newMembers.length > 0) {
      existingRoom.members.push(...newMembers);
      await existingRoom.save();
    }
  }
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

module.exports = {
  ensureChatRoomForTeam,
  ensureChatRoomsForMentorTrack,
  ensureTrackMentorChatRoom
};
