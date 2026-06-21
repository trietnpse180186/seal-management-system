const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../MyProject/seal-management-system/server/.env') });
const mongoose = require('../../../../MyProject/seal-management-system/server/node_modules/mongoose');

// Register models
require('../../../../MyProject/seal-management-system/server/features/auth/User');
require('../../../../MyProject/seal-management-system/server/features/events/Event');
require('../../../../MyProject/seal-management-system/server/features/events/Track');
require('../../../../MyProject/seal-management-system/server/features/events/Round');
require('../../../../MyProject/seal-management-system/server/features/auth/EventRole');
require('../../../../MyProject/seal-management-system/server/features/grading/Rubric');
require('../../../../MyProject/seal-management-system/server/features/grading/Criterion');
require('../../../../MyProject/seal-management-system/server/features/teams/Team');
require('../../../../MyProject/seal-management-system/server/features/teams/TeamMember');
require('../../../../MyProject/seal-management-system/server/features/github-ai/GithubRepository');
require('../../../../MyProject/seal-management-system/server/features/github-ai/Commit');
require('../../../../MyProject/seal-management-system/server/features/github-ai/CommitFile');
require('../../../../MyProject/seal-management-system/server/features/github-ai/AiAnalysis');

const githubService = require('../../../../MyProject/seal-management-system/server/features/github-ai/githubService');
const cronService = require('../../../../MyProject/seal-management-system/server/features/events/cronService');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';

async function test() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  try {
    // 1. Find or create a test event, team and repo
    const Event = mongoose.model('Event');
    const Team = mongoose.model('Team');
    const GithubRepository = mongoose.model('GithubRepository');

    let event = await Event.findOne({ name: 'TEST_SYNC_EVENT' });
    if (!event) {
      event = new Event({
        name: 'TEST_SYNC_EVENT',
        semester: 'Spring',
        year: 2027,
        status: 'ongoing'
      });
      await event.save();
    }

    let team = await Team.findOne({ name: 'TEST_SYNC_TEAM' });
    if (!team) {
      team = new Team({
        eventId: event._id,
        name: 'TEST_SYNC_TEAM',
        status: 'confirmed'
      });
      await team.save();
    }

    let repo = await GithubRepository.findOne({ repoName: 'test-sync-team' });
    if (!repo) {
      repo = new GithubRepository({
        eventId: event._id,
        teamId: team._id,
        repoName: 'test-sync-team',
        repoUrl: 'https://github.com/test-org/test-sync-team',
        githubRepoId: '12345',
        syncStatus: 'not_synced'
      });
      await repo.save();
    }

    // Clear commits and analysis so it syncs fresh
    await mongoose.model('Commit').deleteMany({ teamId: team._id });
    await mongoose.model('AiAnalysis').deleteMany({ teamId: team._id });

    // Mock fetchCommits to return an 'agent' commit so Gemini mock flags it as significant
    const originalFetchCommits = githubService.fetchCommits;
    githubService.fetchCommits = async () => {
      return [
        {
          sha: 'sha-agent-test-12345',
          message: 'feat: implement Agentic RAG tool and routing pipeline',
          authorName: 'Test AI Engineer',
          authorUsername: 'ai-dev',
          authorEmail: 'dev@ai.com',
          committedAt: new Date(),
          additions: 450,
          deletions: 20,
          changedFilesCount: 5
        }
      ];
    };

    console.log('Running syncRepo...');
    const result = await cronService.syncRepo(repo._id);
    console.log('Sync completed with result:', result);

    // Verify issue was created and URL saved
    const analyses = await mongoose.model('AiAnalysis').find({ teamId: team._id, analysisType: 'commit_review' });
    console.log('Number of commit reviews found:', analyses.length);
    if (analyses.length > 0) {
      const firstAnalysis = analyses[0];
      console.log('Significant change flag in DB:', firstAnalysis.result?.overall_picture?.significant_change);
      console.log('GitHub Issue URL saved in DB:', firstAnalysis.result?.github_issue_url);
      
      if (firstAnalysis.result?.github_issue_url) {
        console.log('✅ TEST PASSED: Automatic GitHub Issue creation and DB saving successful!');
      } else {
        console.error('❌ TEST FAILED: GitHub Issue URL is missing from analysis result.');
      }
    } else {
      console.error('❌ TEST FAILED: No commit review found.');
    }

    // Restore original mock function
    githubService.fetchCommits = originalFetchCommits;
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await mongoose.connection.close();
    console.log('DB connection closed.');
  }
}

test();
