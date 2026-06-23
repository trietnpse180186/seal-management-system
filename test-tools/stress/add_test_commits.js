const mongoose = require('../../server/node_modules/mongoose');
const { Octokit } = require('@octokit/rest');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';
const githubToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

// Check token
if (!githubToken) {
  console.error('\x1b[31m[ERROR] GITHUB_PERSONAL_ACCESS_TOKEN is not defined in server/.env\x1b[0m');
  process.exit(1);
}

const octokit = new Octokit({ auth: githubToken });

// Define inline schemas
const EventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  semester: String,
  year: Number,
  status: String,
  commitSyncInterval: { type: Number, default: 30 }
});

const GithubRepositorySchema = new mongoose.Schema({
  eventId: mongoose.Schema.Types.ObjectId,
  trackId: mongoose.Schema.Types.ObjectId,
  teamId: mongoose.Schema.Types.ObjectId,
  orgName: String,
  repoName: String,
  repoUrl: String,
  githubRepoId: String,
  syncStatus: String,
  lastSyncedAt: Date,
  isArchived: { type: Boolean, default: false }
});

const Event = mongoose.models.Event || mongoose.model('Event', EventSchema);
const GithubRepository = mongoose.models.GithubRepository || mongoose.model('GithubRepository', GithubRepositorySchema);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  // Parse arguments
  const args = process.argv.slice(2);
  let numTeamsToCommit = 3; // Default to 3 teams
  let commitAll = false;

  if (args.includes('--all')) {
    commitAll = true;
  } else {
    const parsedNum = parseInt(args[0], 10);
    if (!isNaN(parsedNum) && parsedNum > 0) {
      numTeamsToCommit = parsedNum;
    }
  }

  console.log('\x1b[36m====================================================\x1b[0m');
  console.log('\x1b[36m[GITHUB TEST COMMITER] STARTING...\x1b[0m');
  console.log(`[CONFIG] Target: ${commitAll ? 'ALL TEAMS' : `${numTeamsToCommit} TEAMS`}`);
  console.log('\x1b[36m====================================================\x1b[0m');

  console.log('[DB] Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('[DB] Connected successfully.');

  // Find our stress test event
  const event = await Event.findOne({ name: 'Stress Test Hackathon 2026' });
  if (!event) {
    console.error('\x1b[31m[ERROR] Stress Test Event not found. Please run "node test-tools/stress/stress_data_generator.js 30" first.\x1b[0m');
    await mongoose.disconnect();
    process.exit(1);
  }

  // Fetch all active repositories for this event
  const repos = await GithubRepository.find({ eventId: event._id, isArchived: false });
  console.log(`[DB] Found ${repos.length} active repositories for Stress Test Event.`);

  if (repos.length === 0) {
    console.error('\x1b[31m[ERROR] No active repositories found in database for the event.\x1b[0m');
    await mongoose.disconnect();
    process.exit(1);
  }

  // Determine which repos to commit to
  let selectedRepos = [];
  if (commitAll) {
    selectedRepos = repos;
  } else {
    // Shuffle and pick N repos
    const shuffled = [...repos].sort(() => 0.5 - Math.random());
    selectedRepos = shuffled.slice(0, Math.min(numTeamsToCommit, repos.length));
  }

  console.log(`\n\x1b[32m[PROCESS] Selected ${selectedRepos.length} repository/repositories to commit:\x1b[0m`);
  selectedRepos.forEach(r => console.log(` - ${r.repoName}`));

  const timestamp = new Date().toISOString();

  for (let i = 0; i < selectedRepos.length; i++) {
    const repo = selectedRepos[i];
    console.log(`\n\x1b[35m----------------------------------------------------\x1b[0m`);
    console.log(`[${i + 1}/${selectedRepos.length}] Committing to repo: \x1b[33m${repo.repoName}\x1b[0m`);

    try {
      // 1. Check if sync_test.txt exists to get its SHA
      let fileSha = undefined;
      try {
        const fileContent = await octokit.repos.getContent({
          owner: repo.orgName,
          repo: repo.repoName,
          path: 'src/sync_test.txt'
        });
        if (!Array.isArray(fileContent.data)) {
          fileSha = fileContent.data.sha;
          console.log(`[GITHUB] Found existing sync_test.txt file (SHA: ${fileSha})`);
        }
      } catch (err) {
        // File doesn't exist, which is fine
        console.log(`[GITHUB] sync_test.txt does not exist yet. Creating a new file.`);
      }

      // 2. Write/Update file content to create a commit
      const fileData = `Test Commit Triggered: ${timestamp}\nRandom Key: ${Math.random().toString(36).substring(7)}\n`;
      const commitMessage = `chore: Add test commit for cron sync validation [${timestamp}]`;

      console.log(`[GITHUB] Pushing commit to ${repo.repoName}...`);
      const response = await octokit.repos.createOrUpdateFileContents({
        owner: repo.orgName,
        repo: repo.repoName,
        path: 'src/sync_test.txt',
        message: commitMessage,
        content: Buffer.from(fileData).toString('base64'),
        sha: fileSha
      });

      console.log(`\x1b[32m[SUCCESS] Created commit: ${response.data.commit.sha.substring(0, 7)} in ${repo.repoName}\x1b[0m`);

      // 3. Set syncStatus to 'not_synced' so we can highlight it.
      repo.syncStatus = 'not_synced';
      await repo.save();
      console.log(`[DB] Updated syncStatus of ${repo.repoName} to 'not_synced'.`);

      // Wait a moment to avoid hitting secondary limits
      await sleep(1000);

    } catch (error) {
      console.error(`\x1b[31m[ERROR] Failed to commit to ${repo.repoName}:\x1b[0m`, error.message);
    }
  }

  console.log(`\n\x1b[36m====================================================\x1b[0m`);
  console.log(`\x1b[36m[COMPLETED] Successfully pushed commits to selected repositories!\x1b[0m`);
  console.log(`\x1b[36m[INFO] Cron service should automatically pull these new commits in the next 2-minute cycle.\x1b[0m`);
  console.log(`\x1b[36m====================================================\x1b[0m`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('\x1b[31m[FATAL ERROR]:\x1b[0m', err);
  await mongoose.disconnect();
});
