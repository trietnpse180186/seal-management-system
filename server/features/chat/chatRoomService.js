const mongoose = require('mongoose');

async function ensureChatRoomForTeam(team) {
  const ChatRoom = mongoose.model('ChatRoom');
  const EventRole = mongoose.model('EventRole');
  const TeamMember = mongoose.model('TeamMember');

  if (!team.trackId) return;

  // Find mentors for this track
  const mentors = await EventRole.find({
    eventId: team.eventId,
    trackId: team.trackId,
    role: 'mentor',
    status: 'active'
  });

  if (mentors.length === 0) return;

  // Find all team members
  const teamMembers = await TeamMember.find({ teamId: team._id, confirmStatus: 'confirmed' });
  const memberIds = teamMembers.map(tm => tm.userId);

  for (const mentorRole of mentors) {
    // Check if room already exists
    const existingRoom = await ChatRoom.findOne({ teamId: team._id, mentorId: mentorRole.userId });
    if (!existingRoom) {
      const room = new ChatRoom({
        teamId: team._id,
        mentorId: mentorRole.userId,
        eventId: team.eventId,
        members: [...memberIds, mentorRole.userId]
      });
      await room.save();
      console.log(`[CHAT] Created room for team ${team.name} and mentor ${mentorRole.userId}`);
    } else {
      // Ensure all current members are in the room
      const allMembers = [...memberIds, mentorRole.userId];
      const newMembers = allMembers.filter(id => !existingRoom.members.includes(id));
      if (newMembers.length > 0) {
        existingRoom.members.push(...newMembers);
        await existingRoom.save();
      }
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

module.exports = {
  ensureChatRoomForTeam,
  ensureChatRoomsForMentorTrack
};
