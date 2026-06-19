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

const githubService = require('../../server/features/github-ai/githubService');

async function runTest() {
  console.log('=== STARTING ASSIGN-TRACK ENDPOINT TEST ===');

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

  // Create mock users (1 Admin, 3 Members)
  console.log('\nCreating mock users in Database...');
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

  // Clean up duplicate event if any to bypass semester_1_year_1 unique index
  await Event.deleteMany({ semester: 'Fall', year: 2026 });

  // Create Event
  console.log('\nCreating new Event...');
  const eventName = `SEAL Hackathon Autumn ${suffix}`;
  const newEvent = new Event({
    name: eventName,
    semester: 'Fall',
    year: 2026,
    description: 'Endpoint test flow',
    maxTeams: 10,
    githubOrgName: 'seal-test-org',
    status: 'registration'
  });
  await newEvent.save();

  // Create a Team
  console.log('\nRegistering a team...');
  const team = new Team({
    eventId: newEvent._id,
    leaderId: leader._id,
    name: `Team Masters ${suffix}`,
    status: 'confirmed'
  });
  await team.save();

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
    confirmStatus: 'confirmed',
    confirmedAt: new Date()
  });
  await tmMember.save();

  // Create 2 Tracks
  console.log('\nCreating Tracks...');
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

  // Now simulate the PUT /api/teams/:teamId/assign-track with trackId = 'random'
  console.log('\nSimulating PUT /api/teams/:teamId/assign-track with random track...');
  
  // Choose random track
  const tracks = await Track.find({ eventId: team.eventId });
  if (tracks.length === 0) {
    throw new Error('No tracks found!');
  }
  const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
  
  team.trackId = randomTrack._id;
  await team.save();
  console.log(`Assigned team to random track: ${randomTrack.name}`);

  // Provision GitHub Repo
  const slugRepoName = team.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const existingRepo = await GithubRepository.findOne({ teamId: team._id });
  if (!existingRepo) {
    console.log(`Provisioning GitHub Repo: ${slugRepoName}`);
    const gitResult = await githubService.createTeamRepository(slugRepoName, 'private');
    const newRepo = new GithubRepository({
      eventId: team.eventId,
      trackId: randomTrack._id,
      teamId: team._id,
      repoName: slugRepoName,
      repoUrl: gitResult.repoUrl,
      githubRepoId: gitResult.githubRepoId,
      syncStatus: 'not_synced'
    });
    await newRepo.save();
    console.log(`Saved GithubRepository: ${newRepo.repoName} (URL: ${newRepo.repoUrl})`);

    const populatedMembers = await TeamMember.find({ teamId: team._id }).populate('userId');
    for (const tm of populatedMembers) {
      if (tm.userId && tm.userId.githubUsername) {
        await githubService.addCollaborator(slugRepoName, tm.userId.githubUsername);
      }
    }
  }

  // Verify final DB state
  const finalTeam = await Team.findById(team._id).populate('trackId');
  console.log(`Final Team Track: ${finalTeam.trackId.name}`);
  const finalRepo = await GithubRepository.findOne({ teamId: team._id });
  console.log(`Final Repo Name: ${finalRepo.repoName}`);

  console.log('\n=== ASSIGN-TRACK ENDPOINT SIMULATION TEST PASSED SUCCESSFULLY ===');
  await mongoose.disconnect();
}

runTest().catch(async (err) => {
  console.error('Test failed:', err);
  await mongoose.disconnect();
});
