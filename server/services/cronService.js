const cron = require('node-cron');
const mongoose = require('mongoose');
const githubService = require('./githubService');
const aiService = require('./aiService');

// Retrieve models dynamically to avoid import circular issues
const GithubRepository = mongoose.model('GithubRepository');
const Commit = mongoose.model('Commit');
const CommitFile = mongoose.model('CommitFile');
const AiAnalysis = mongoose.model('AiAnalysis');
const Team = mongoose.model('Team');

/**
 * Initializes cron jobs for the system
 */
function startCronJobs() {
  console.log('[CRON] Initializing background task schedulers...');
  
  // Schedule to run every 30 minutes: '*/30 * * * *'
  // For development testing, we can run it every 10 minutes or check standard:
  cron.schedule('*/30 * * * *', async () => {
    console.log('[CRON] Running scheduled 30-minute GitHub commit sync...');
    try {
      await syncAllRepositories();
    } catch (error) {
      console.error('[CRON ERROR] Failed to sync commits:', error.message);
    }
  });

  console.log('[CRON] Background task scheduler started. Repo sync scheduled for every 30 minutes.');
}

/**
 * Syncs all active repositories in the database
 */
async function syncAllRepositories() {
  const activeRepos = await GithubRepository.find({ isArchived: false });
  console.log(`[CRON] Syncing ${activeRepos.length} repository/repositories...`);
  
  for (const repo of activeRepos) {
    try {
      await syncRepo(repo._id);
    } catch (err) {
      console.error(`[CRON ERROR] Failed syncing repo ID ${repo._id}:`, err.message);
    }
  }
}

/**
 * Syncs a single repository by its DB Object ID
 * @param {string|ObjectId} repoId - MongoDB ObjectID of GithubRepository
 * @returns {Promise<boolean>}
 */
async function syncRepo(repoId) {
  const repo = await GithubRepository.findById(repoId);
  if (!repo) {
    throw new Error('Repository not found in database');
  }

  console.log(`[SYNC] Started sync for repo: ${repo.repoName}`);
  repo.syncStatus = 'syncing';
  await repo.save();

  try {
    // Determine the date to pull commits since
    const sinceDate = repo.lastSyncedAt || null;
    
    // Fetch commits from github
    const newCommits = await githubService.fetchCommits(repo.repoName, sinceDate, repo.orgName);
    console.log(`[SYNC] Found ${newCommits.length} new commits since last sync.`);

    if (newCommits.length === 0) {
      repo.syncStatus = 'success';
      repo.lastSyncedAt = new Date();
      await repo.save();
      console.log(`[SYNC] No new commits for: ${repo.repoName}`);
      return true;
    }

    // Sort new commits by date ascending so we process in order
    newCommits.sort((a, b) => new Date(a.committedAt).getTime() - new Date(b.committedAt).getTime());

    let latestSha = repo.lastCommitSha;
    const syncedCommits = [];

    for (const rawCommit of newCommits) {
      // Check if commit already exists
      let commitRecord = await Commit.findOne({ repositoryId: repo._id, commitSha: rawCommit.sha });
      
      if (!commitRecord) {
        // Create Commit record
        commitRecord = new Commit({
          repositoryId: repo._id,
          teamId: repo.teamId,
          commitSha: rawCommit.sha,
          branch: repo.defaultBranch || 'main',
          authorGithubUsername: rawCommit.authorUsername,
          authorName: rawCommit.authorName,
          authorEmail: rawCommit.authorEmail,
          message: rawCommit.message,
          commitUrl: rawCommit.commitUrl || '',
          additions: rawCommit.additions,
          deletions: rawCommit.deletions,
          changedFilesCount: rawCommit.changedFilesCount,
          committedAt: rawCommit.committedAt,
          pulledAt: new Date(),
          diffFetched: true
        });
        await commitRecord.save();

        // Fetch and create CommitFile records
        const commitFiles = await githubService.fetchCommitFiles(repo.repoName, rawCommit.sha, repo.orgName);
        const savedFiles = [];

        for (const file of commitFiles) {
          // Truncate file patch at 3,000 characters
          let patchContent = file.patch || '';
          if (patchContent.length > 3000) {
            patchContent = patchContent.substring(0, 3000) + '\n... [Truncated due to size limits] ...';
          }

          const fileRecord = new CommitFile({
            commitId: commitRecord._id,
            repositoryId: repo._id,
            filename: file.filename,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
            patch: patchContent,
            rawUrl: file.rawUrl || '',
            blobUrl: file.blobUrl || ''
          });
          await fileRecord.save();
          savedFiles.push(fileRecord);
        }

        // Firebase Realtime Database Sync
        const firebaseData = {
          team_id: repo.teamId.toString(),
          commit_sha: commitRecord.commitSha,
          repo_name: repo.repoName,
          author: commitRecord.authorName,
          commit_message: commitRecord.message,
          committed_at: commitRecord.committedAt,
          source: 'webhook'
        };

        if (process.env.FIREBASE_DATABASE_URL) {
          const cleanFbUrl = process.env.FIREBASE_DATABASE_URL.replace(/\/$/, '');
          const fbUrl = `${cleanFbUrl}/commit/${commitRecord.commitSha}.json`;
          console.log(`[FIREBASE] Syncing raw commit to Firebase: ${fbUrl}`);
          
          fetch(fbUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(firebaseData)
          })
          .then(res => {
            if (!res.ok) console.error(`[FIREBASE ERROR] Failed to write to Firebase: Status ${res.status}`);
            else console.log(`[FIREBASE] Successfully synced commit ${commitRecord.commitSha.substring(0, 7)} to Firebase`);
          })
          .catch(err => {
            console.error('[FIREBASE ERROR] Connection failed:', err.message);
          });
        } else {
          console.log(`[FIREBASE MOCK] Syncing raw commit thô to Firebase: /commit/${commitRecord.commitSha}.json`);
        }
        
        syncedCommits.push({ commitRecord, savedFiles });
      }

      // Track the latest commit SHA
      if (!latestSha || new Date(rawCommit.committedAt) > (repo.lastSyncedAt || new Date(0))) {
        latestSha = rawCommit.sha;
      }
    }

    // Now, run the per-push batch analysis for the synced commits in this run
    if (syncedCommits.length > 0) {
      console.log(`[SYNC] Running per-push review on ${syncedCommits.length} synced commit(s)...`);
      const latestSyncItem = syncedCommits[syncedCommits.length - 1];
      const latestCommit = latestSyncItem.commitRecord;

      // Aggregate diff content for the batch, filtering out lockfiles and readmes
      const skipFiles = ['.gitignore', 'package-lock.json', 'yarn.lock', '.env', 'README.md'];
      let aggregatedDiff = '';
      let additionsCount = 0;
      let deletionsCount = 0;
      let filesCount = 0;
      const allFiles = [];

      for (const item of syncedCommits) {
        additionsCount += item.commitRecord.additions || 0;
        deletionsCount += item.commitRecord.deletions || 0;
        filesCount += item.commitRecord.changedFilesCount || 0;

        for (const f of item.savedFiles) {
          if (skipFiles.some(skip => f.filename.endsWith(skip))) continue;
          allFiles.push(f);
          if (aggregatedDiff.length < 50000) {
            aggregatedDiff += `\n=== COMMIT-BOUNDARY: ${item.commitRecord.commitSha.substring(0, 7)} ===\n`;
            aggregatedDiff += `File: ${f.filename}\nPatch:\n${f.patch}\n`;
          }
        }
      }

      // Cap aggregated diff at 50,000 characters
      if (aggregatedDiff.length > 50000) {
        aggregatedDiff = aggregatedDiff.substring(0, 50000) + '\n... [Total diff aggregated batch truncated at 50,000 characters] ...';
      }

      // Create a temporary commit object representing the sync batch review
      const batchCommit = {
        authorName: latestCommit.authorName,
        authorGithubUsername: latestCommit.authorGithubUsername,
        commitSha: latestCommit.commitSha,
        message: `Batch Sync Review: ${syncedCommits.map(s => s.commitRecord.message).join('; ')}`,
        additions: additionsCount,
        deletions: deletionsCount,
        changedFilesCount: filesCount
      };

      const batchFiles = [{
        filename: 'Aggregated_Batch_Changes',
        status: 'modified',
        additions: additionsCount,
        deletions: deletionsCount,
        patch: aggregatedDiff
      }];

      // Call Gemini for Per-Push batch analysis
      try {
        const aiResult = await aiService.analyzeCommit(batchCommit, batchFiles);
        
        const aiAnalysis = new AiAnalysis({
          repositoryId: repo._id,
          teamId: repo.teamId,
          commitId: latestCommit._id,
          analysisType: 'commit_review',
          provider: 'Google Gemini',
          model: 'gemini-3.1-flash-lite',
          result: aiResult,
          status: 'completed',
          completedAt: new Date()
        });
        await aiAnalysis.save();

        // Update latest commit with summary
        latestCommit.diffSummary = aiResult.overall_picture?.push_summary || aiResult.summary || '';
        await latestCommit.save();

        console.log(`[SYNC] Completed per-push AI analysis successfully.`);

      } catch (aiErr) {
        console.error(`[SYNC] Gemini AI per-push review failed:`, aiErr.message);
        const aiAnalysisFailed = new AiAnalysis({
          repositoryId: repo._id,
          teamId: repo.teamId,
          commitId: latestCommit._id,
          analysisType: 'commit_review',
          status: 'failed',
          errorMessage: aiErr.message
        });
        await aiAnalysisFailed.save();
      }

      // After per-push review, automatically trigger Team Aggregate review
      try {
        console.log(`[SYNC] Auto-triggering Team Aggregate Review for team: ${repo.teamId}...`);
        
        // Fetch up to 200 commits for the team
        const allTeamCommits = await Commit.find({ teamId: repo.teamId }).sort({ committedAt: 1 }).limit(200);
        // Fetch up to 40 prior reviews
        const priorReviews = await AiAnalysis.find({
          teamId: repo.teamId,
          analysisType: 'commit_review',
          status: 'completed'
        }).sort({ createdAt: -1 }).limit(40);

        const aggResult = await aiService.analyzeTeamAggregate(repo.teamId, allTeamCommits, priorReviews);

        const aggAnalysis = new AiAnalysis({
          repositoryId: repo._id,
          teamId: repo.teamId,
          analysisType: 'repository_review', // Maps to team_aggregate
          provider: 'Google Gemini',
          model: 'gemini-3.1-flash-lite',
          result: aggResult,
          status: 'completed',
          completedAt: new Date()
        });
        await aggAnalysis.save();
        console.log(`[SYNC] Completed Team Aggregate AI review successfully.`);

      } catch (aggErr) {
        console.error(`[SYNC] Gemini AI team aggregate review failed:`, aggErr.message);
        const aggAnalysisFailed = new AiAnalysis({
          repositoryId: repo._id,
          teamId: repo.teamId,
          analysisType: 'repository_review',
          status: 'failed',
          errorMessage: aggErr.message
        });
        await aggAnalysisFailed.save();
      }
    }

    // Update repository record status
    repo.syncStatus = 'success';
    repo.lastSyncedAt = new Date();
    if (latestSha) {
      repo.lastCommitSha = latestSha;
    }
    repo.syncErrorMessage = null;
    await repo.save();
    console.log(`[SYNC] Completed sync successfully for: ${repo.repoName}`);
    return true;

  } catch (error) {
    console.error(`[SYNC ERROR] Failed to sync repo ${repo.repoName}:`, error.message);
    repo.syncStatus = 'failed';
    repo.syncErrorMessage = error.message;
    await repo.save();
    return false;
  }
}

module.exports = {
  startCronJobs,
  syncRepo,
  syncAllRepositories
};
