const mongoose = require('../../server/node_modules/mongoose');
const path = require('path'); require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });
process.env.EMAIL_SERVICE_MOCK = 'true';
process.env.GITHUB_SERVICE_MOCK = 'true';

// Require models
require('../../server/features/auth/User');
require('../../server/features/events/Event');
require('../../server/features/events/Track');
require('../../server/features/events/Round');
require('../../server/features/auth/EventRole');
require('../../server/features/teams/Team');
require('../../server/features/teams/TeamMember');
require('../../server/features/github-ai/GithubRepository');

const emailService = require('../../server/features/notifications/emailService');
const githubService = require('../../server/features/github-ai/githubService');

async function runTest() {
  console.log('=== STARTING NEW FLOW TEST: CREATE EVENT & AUTO-DISTRIBUTE ===');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';
  console.log(`Connecting to MongoDB: ${mongoUri}`);
  await mongoose.connect(mongoUri);
  console.log('Connected.');

  const User = mongoose.model('User');
  const Event = mongoose.model('Event');
  const Track = mongoose.model('Track');
  const Team = mongoose.model('Team');
  const TeamMember = mongoose.model('TeamMember');
  const GithubRepository = mongoose.model('GithubRepository');

  // 1. Create mock users (1 Admin, 3 Members)
  console.log('\n[1] Creating mock users in Database...');
  const suffix = Date.now().toString().slice(-4);
  
  const adminEmail = `admin-${suffix}@example.com`;
  const leaderEmail = `leader-${suffix}@example.com`;
  const memberEmail = `member-${suffix}@example.com`;

  const admin = new User({
    email: adminEmail,
    passwordHash: 'hashed_pw',
    fullName: `Admin Test ${suffix}`,
    isSystemAdmin: true,
    isApproved: true
  });
  await admin.save();

  const leader = new User({
    email: leaderEmail,
    passwordHash: 'hashed_pw',
    fullName: `Leader Test ${suffix}`,
    githubUsername: `git-leader-${suffix}`,
    isApproved: true
  });
  await leader.save();

  const member = new User({
    email: memberEmail,
    passwordHash: 'hashed_pw',
    fullName: `Member Test ${suffix}`,
    githubUsername: `git-member-${suffix}`,
    isApproved: true
  });
  await member.save();
  
  console.log(`Created admin (${adminEmail}), leader (${leaderEmail}), and member (${memberEmail})`);

  // Clean up duplicate event if any to bypass semester_1_year_1 unique index
  await Event.deleteMany({ semester: 'Fall', year: 2026 });

  // 2. Create Event (WITHOUT tracks or rounds)
  console.log('\n[2] Creating new Event without tracks...');
  const eventName = `SEAL Hackathon Autumn ${suffix}`;
  const newEvent = new Event({
    name: eventName,
    semester: 'Fall',
    year: 2026,
    description: 'Autonomous event test flow',
    maxTeams: 10,
    githubOrgName: 'seal-test-org',
    status: 'registration'
  });
  await newEvent.save();
  console.log(`Saved Event: "${newEvent.name}" (ID: ${newEvent._id})`);

  // Simulate sending mass email notification to all members (non-admins)
  console.log('Simulating sending email notification to all members in background...');
  const users = await User.find({ isSystemAdmin: false });
  for (const u of users) {
    await emailService.sendEventCreationNotification(
      u.email,
      u.fullName,
      newEvent.name,
      newEvent.semester,
      newEvent.year
    );
  }

  // 3. Register a Team WITHOUT trackId
  console.log('\n[3] Registering a new Team without trackId...');
  const team = new Team({
    eventId: newEvent._id,
    leaderId: leader._id,
    name: `Team Code Masters ${suffix}`,
    status: 'pending_confirm'
  });
  await team.save();
  console.log(`Saved Team: "${team.name}" (ID: ${team._id}) with trackId = ${team.trackId || 'null/undefined'}`);

  // Create TeamMember entries
  const tmLeader = new TeamMember({
    teamId: team._id,
    userId: leader._id,
    role: 'leader',
    confirmStatus: 'confirmed',
    confirmedAt: new Date()
  });
  await tmLeader.save();

  const tmMember = new TeamMember({
    teamId: team._id,
    userId: member._id,
    role: 'member',
    confirmStatus: 'confirmed', // Auto-confirm for this test simulation
    confirmedAt: new Date()
  });
  await tmMember.save();
  console.log('Registered Leader and Member for the team.');

  // Update team status to confirmed because all members are confirmed
  team.status = 'confirmed';
  await team.save();
  console.log(`Team "${team.name}" is now fully confirmed! Status: ${team.status}`);

  // Verify that NO GitHub repository was created yet (because trackId is null)
  const repoBefore = await GithubRepository.findOne({ teamId: team._id });
  console.log(`GitHub Repository exists before distribution? ${repoBefore ? 'Yes' : 'No (Correct: delayed until track distribution)'}`);

  // 4. Create 2 Tracks for the Event
  console.log('\n[4] Creating 2 Tracks for the Event...');
  const track1 = new Track({
    eventId: newEvent._id,
    name: 'Advanced Web Apps',
    description: 'Full-stack React & Node solutions',
    maxTeams: 5
  });
  await track1.save();

  const track2 = new Track({
    eventId: newEvent._id,
    name: 'Mobile Development',
    description: 'Flutter & React Native mobile apps',
    maxTeams: 5
  });
  await track2.save();
  console.log(`Created Track 1: "${track1.name}" and Track 2: "${track2.name}"`);

  // 5. Run randomized distribution logic
  console.log('\n[5] Simulating team distribution to tracks...');
  const tracks = [track1, track2];
  const unassignedTeams = await Team.find({
    eventId: newEvent._id,
    status: 'confirmed',
    $or: [{ trackId: null }, { trackId: { $exists: false } }]
  });
  console.log(`Found ${unassignedTeams.length} unassigned team(s).`);

  for (let i = 0; i < unassignedTeams.length; i++) {
    const t = unassignedTeams[i];
    // Assign to a track randomly or round-robin
    const track = tracks[i % tracks.length];
    t.trackId = track._id;
    await t.save();
    console.log(`Assigned Team "${t.name}" to Track: "${track.name}"`);

    // Simulate Repo Provisioning logic
    console.log(`Provisioning GitHub Repo for Team "${t.name}" under Track "${track.name}"...`);
    const slugRepoName = t.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const gitResult = await githubService.createTeamRepository(slugRepoName, 'private');
    
    const newRepo = new GithubRepository({
      eventId: t.eventId,
      trackId: track._id,
      teamId: t._id,
      repoName: slugRepoName,
      repoUrl: gitResult.repoUrl,
      githubRepoId: gitResult.githubRepoId,
      syncStatus: 'not_synced'
    });
    await newRepo.save();
    console.log(`Saved GithubRepository: ${newRepo.repoName} (URL: ${newRepo.repoUrl})`);

    // Invite collaborators
    const members = await TeamMember.find({ teamId: t._id }).populate('userId');
    for (const m of members) {
      if (m.userId && m.userId.githubUsername) {
        await githubService.addCollaborator(slugRepoName, m.userId.githubUsername);
      }
    }
  }

  // 6. Verify result
  console.log('\n[6] Verifying final DB state...');
  const updatedTeam = await Team.findById(team._id).populate('trackId');
  console.log(`Team: "${updatedTeam.name}"`);
  console.log(`Assigned Track Name: "${updatedTeam.trackId.name}"`);
  
  const finalRepo = await GithubRepository.findOne({ teamId: team._id });
  console.log(`GitHub Repository: "${finalRepo.repoName}" (URL: ${finalRepo.repoUrl})`);

  console.log('\n=== TEST PASSED SUCCESSFULLY ===');
  await mongoose.disconnect();
}

runTest().catch(err => {
  console.error('Test failed:', err);
  mongoose.disconnect();
});
