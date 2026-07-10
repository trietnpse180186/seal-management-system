const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';

mongoose.connect(MONGO_URI).then(async () => {
  const Team = mongoose.model('Team');
  const TeamMember = mongoose.model('TeamMember');
  const User = mongoose.model('User');
  const EventRole = mongoose.model('EventRole');
  const Event = mongoose.model('Event');

  console.log('\n=== LISTING TEAMS & MEMBERS ===');
  const teams = await Team.find({});
  for (const team of teams) {
    const event = await Event.findById(team.eventId);
    console.log(`\nTeam Name: "${team.name}" (Status: ${team.status})`);
    console.log(`Event Name: "${event ? event.name : 'Unknown'}" (Status: ${event ? event.status : 'None'})`);
    
    // Find members
    const members = await TeamMember.find({ teamId: team._id });
    console.log(`Members count: ${members.length}`);
    for (const m of members) {
      const u = await User.findById(m.userId);
      if (u) {
        console.log(` - Student: ${u.fullName} | Email: ${u.email} | Status: ${m.confirmStatus}`);
      }
    }
    
    // Mentor
    if (team.mentorId) {
      const mentor = await User.findById(team.mentorId);
      if (mentor) {
        console.log(` - Mentor: ${mentor.fullName} | Email: ${mentor.email}`);
      }
    }
  }

  console.log('\n=== LISTING MENTORS & COORDINATORS ===');
  const roles = await EventRole.find({});
  for (const r of roles) {
    const u = await User.findById(r.userId);
    const event = await Event.findById(r.eventId);
    if (u) {
      console.log(`User: ${u.fullName} | Email: ${u.email} | Role: ${r.role} (Status: ${r.status}) | Event: ${event ? event.name : 'None'}`);
    }
  }

  console.log('\n=== LISTING SYSTEM ADMINS ===');
  const admins = await User.find({ isSystemAdmin: true });
  for (const a of admins) {
    console.log(`Admin Name: ${a.fullName} | Email: ${a.email}`);
  }

  mongoose.disconnect();
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
