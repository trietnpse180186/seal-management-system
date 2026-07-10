const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';
console.log('Connecting to MONGO_URI:', MONGO_URI);

mongoose.connect(MONGO_URI).then(async () => {
  console.log('Connected to MongoDB.');

  // Load models
  require('./features/auth/User');
  require('./features/events/Event');
  require('./features/events/Track');
  require('./features/events/Round');
  require('./features/teams/Team');
  require('./features/teams/TeamMember');
  require('./features/events/EventRole');
  require('./features/chat/ChatRoom');
  require('./features/chat/ChatMessage');

  const User = mongoose.model('User');
  const Event = mongoose.model('Event');
  const Track = mongoose.model('Track');
  const Round = mongoose.model('Round');
  const Team = mongoose.model('Team');
  const TeamMember = mongoose.model('TeamMember');
  const EventRole = mongoose.model('EventRole');
  const ChatRoom = mongoose.model('ChatRoom');

  // 1. Find or create an ongoing event
  let event = await Event.findOne({ status: 'ongoing' });
  if (!event) {
    event = await Event.findOne({});
  }
  if (!event) {
    // Create event
    event = new Event({
      name: 'Hackathon Test Chat 2026',
      semester: 'Summer',
      year: 2026,
      status: 'ongoing',
      isArchived: false,
      maxTeams: 10
    });
    await event.save();
    console.log('Created ongoing Event:', event.name);
  } else {
    event.status = 'ongoing';
    await event.save();
    console.log('Using Event:', event.name, 'ID:', event._id);
  }

  // 2. Find or create a Track
  let track = await Track.findOne({ eventId: event._id });
  if (!track) {
    track = new Track({
      name: 'AI & IoT Smart Automation',
      description: 'Bảng thi đấu thử nghiệm Chat',
      eventId: event._id
    });
    await track.save();
    console.log('Created Track:', track.name);
  }

  // 3. Create or update test users with password '123'
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('123', salt);

  const testUsers = [
    { email: 'admin@seal.com', fullName: 'Quản trị viên Hệ thống', isSystemAdmin: true },
    { email: 'mentor@seal.com', fullName: 'Mentor Nguyễn Văn Hải', isSystemAdmin: false },
    { email: 'student@seal.com', fullName: 'Thí sinh Nguyễn Văn Minh', isSystemAdmin: false }
  ];

  const dbUsers = {};

  for (const tu of testUsers) {
    let u = await User.findOne({ email: tu.email });
    if (!u) {
      u = new User({
        email: tu.email,
        fullName: tu.fullName,
        passwordHash,
        isActive: true,
        isApproved: true,
        isSystemAdmin: tu.isSystemAdmin
      });
    } else {
      u.passwordHash = passwordHash;
      u.isApproved = true;
      u.isActive = true;
      u.isSystemAdmin = tu.isSystemAdmin;
      u.fullName = tu.fullName;
    }
    await u.save();
    console.log(`Saved user: ${u.email} | ID: ${u._id}`);
    dbUsers[tu.email] = u;
  }

  // 4. Create EventRole for Mentor
  await EventRole.deleteMany({ userId: dbUsers['mentor@seal.com']._id });
  const mentorRole = new EventRole({
    userId: dbUsers['mentor@seal.com']._id,
    eventId: event._id,
    trackId: track._id,
    role: 'mentor',
    status: 'active'
  });
  await mentorRole.save();
  console.log('Assigned Mentor Role for mentor@seal.com');

  // 5. Create Team and Add Student
  let team = await Team.findOne({ eventId: event._id, name: 'Đội thi Super Coders' });
  if (!team) {
    team = new Team({
      name: 'Đội thi Super Coders',
      eventId: event._id,
      trackId: track._id,
      status: 'confirmed',
      leaderId: dbUsers['student@seal.com']._id,
      mentorId: dbUsers['mentor@seal.com']._id
    });
  } else {
    team.leaderId = dbUsers['student@seal.com']._id;
    team.mentorId = dbUsers['mentor@seal.com']._id;
    team.status = 'confirmed';
    team.trackId = track._id;
  }
  await team.save();
  console.log('Saved Team:', team.name, 'assigned to Mentor:', dbUsers['mentor@seal.com'].fullName);

  // Add team member
  await TeamMember.deleteMany({ teamId: team._id });
  const member = new TeamMember({
    teamId: team._id,
    userId: dbUsers['student@seal.com']._id,
    role: 'leader',
    confirmStatus: 'confirmed'
  });
  await member.save();
  console.log('Added student@seal.com to team');

  // 6. Ensure ChatRooms
  const { ensureEventGeneralChatRoom, ensureTrackMentorChatRoom, ensureChatRoomForTeam } = require('./features/chat/chatRoomService');
  
  const generalRoom = await ensureEventGeneralChatRoom(event._id);
  console.log('Ensured Event General Chat Room:', generalRoom._id);

  const trackRoom = await ensureTrackMentorChatRoom(track._id, event._id);
  console.log('Ensured Track Mentor Chat Room:', trackRoom._id);

  const teamRoom = await ensureChatRoomForTeam(team);
  console.log('Ensured Team Mentor Chat Room:', teamRoom._id);

  console.log('\n===========================================');
  console.log('TEST DATA CONFIGURATION COMPLETED!');
  console.log('You can now log in using:');
  console.log('1. Student: student@seal.com | Password: 123');
  console.log('2. Mentor:  mentor@seal.com  | Password: 123');
  console.log('3. Admin:   admin@seal.com   | Password: 123');
  console.log('===========================================');

  mongoose.disconnect();
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
