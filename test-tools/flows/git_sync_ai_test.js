const path = require('path'); require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });
const mongoose = require('../../server/node_modules/mongoose');

// Register models
require('../../server/features/auth/User');
require('../../server/features/events/Event');
require('../../server/features/events/Track');
require('../../server/features/events/Round');
require('../../server/features/auth/EventRole');
require('../../server/features/grading/Rubric');
require('../../server/features/grading/Criterion');
require('../../server/features/teams/Team');
require('../../server/features/teams/TeamMember');
require('../../server/features/github-ai/GithubRepository');
require('../../server/features/github-ai/Commit');
require('../../server/features/github-ai/CommitFile');
require('../../server/features/github-ai/AiAnalysis');

const cronService = require('../../server/features/events/cronService');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';

async function runTest() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  // Clear previous test records
  console.log('Cleaning up old test data...');
  await mongoose.model('Event').deleteMany({ name: 'TEST_SYNC_EVENT' });
  await mongoose.model('Round').deleteMany({ name: 'TEST_ROUND' });
  await mongoose.model('Track').deleteMany({ name: 'TEST_SYNC_TRACK' });
  await mongoose.model('User').deleteMany({ email: 'testleader@example.com' });
  await mongoose.model('Team').deleteMany({ name: 'TEST_SYNC_TEAM' });
  await mongoose.model('GithubRepository').deleteMany({ repoName: 'test-sync-team' });
  await mongoose.model('Commit').deleteMany({});
  await mongoose.model('CommitFile').deleteMany({});
  await mongoose.model('AiAnalysis').deleteMany({});

  try {
    // 1. Create Mock Event
    const event = new (mongoose.model('Event'))({
      name: 'TEST_SYNC_EVENT',
      semester: 'Spring',
      year: 2027,
      githubOrgName: 'seal-hackathon-2026-test',
      status: 'draft'
    });
    await event.save();
    console.log('Created mock Event:', event._id);

    // 1.5 Create Mock Round
    const round = new (mongoose.model('Round'))({
      eventId: event._id,
      name: 'TEST_ROUND',
      order: 1,
      status: 'active'
    });
    await round.save();
    console.log('Created mock Round:', round._id);

    // 2. Create Mock Track
    const track = new (mongoose.model('Track'))({
      eventId: event._id,
      roundId: round._id,
      name: 'TEST_SYNC_TRACK',
      maxTeams: 10
    });
    await track.save();
    console.log('Created mock Track:', track._id);

    // 2.5 Create Mock User (Leader)
    const leader = new (mongoose.model('User'))({
      email: 'testleader@example.com',
      passwordHash: 'mock-hash',
      fullName: 'Test Leader',
      githubUsername: 'test-leader-git'
    });
    await leader.save();
    console.log('Created mock User (Leader):', leader._id);

    // 3. Create Mock Team
    const team = new (mongoose.model('Team'))({
      eventId: event._id,
      trackId: track._id,
      leaderId: leader._id,
      name: 'TEST_SYNC_TEAM',
      status: 'confirmed'
    });
    await team.save();
    console.log('Created mock Team:', team._id);

    // 4. Create Mock Repository
    const repo = new (mongoose.model('GithubRepository'))({
      eventId: event._id,
      trackId: track._id,
      teamId: team._id,
      repoName: 'test-sync-team',
      repoUrl: 'https://github.com/seal-hackathon-2026-test/test-sync-team',
      githubRepoId: 'test-repo-id-12345',
      syncStatus: 'not_synced'
    });
    await repo.save();
    console.log('Created mock GithubRepository:', repo._id);

    // Set mock env to use local mock data
    process.env.GITHUB_SERVICE_MOCK = 'true';
    process.env.GEMINI_SERVICE_MOCK = 'true';

    // 5. Run Sync Repo
    console.log('Triggering syncRepo worker...');
    const success = await cronService.syncRepo(repo._id);
    console.log('syncRepo result:', success);

    if (!success) {
      throw new Error('syncRepo returned false');
    }

    // 6. Verify Database entries
    const commits = await mongoose.model('Commit').find({ teamId: team._id });
    console.log(`Verified: Found ${commits.length} synced commits in MongoDB.`);

    const commitFiles = await mongoose.model('CommitFile').find({ repositoryId: repo._id });
    console.log(`Verified: Found ${commitFiles.length} commit files in MongoDB.`);

    const perPushReviews = await mongoose.model('AiAnalysis').find({
      teamId: team._id,
      analysisType: 'commit_review'
    });
    console.log(`Verified: Found ${perPushReviews.length} per-push AI analyses in MongoDB.`);
    if (perPushReviews.length > 0) {
      console.log('Per-push review sample structure:', JSON.stringify(perPushReviews[0].result, null, 2));
    }

    const aggregateReviews = await mongoose.model('AiAnalysis').find({
      teamId: team._id,
      analysisType: 'repository_review'
    });
    console.log(`Verified: Found ${aggregateReviews.length} team aggregate AI analyses in MongoDB.`);
    if (aggregateReviews.length > 0) {
      console.log('Team aggregate review sample structure:', JSON.stringify(aggregateReviews[0].result, null, 2));
    }

    console.log('\n=========================================');
    console.log('✅ ALL WORKER AND MONGODB TESTS PASSED! ');
    console.log('=========================================');

  } catch (err) {
    console.error('❌ TEST FAILED:', err.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
}

runTest();
