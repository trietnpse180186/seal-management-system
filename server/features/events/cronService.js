const cron = require('node-cron');
const mongoose = require('mongoose');
const githubService = require('../github-ai/githubService');
const aiService = require('../github-ai/aiService');
const githubAiQueue = require('../github-ai/githubAiQueue');

// Retrieve models dynamically to avoid import circular issues
const GithubRepository = mongoose.model('GithubRepository');
const Commit = mongoose.model('Commit');
const CommitFile = mongoose.model('CommitFile');
const AiAnalysis = mongoose.model('AiAnalysis');
const Team = mongoose.model('Team');
const Event = mongoose.model('Event');

/**
 * Automatically transitions event status based on scheduled times.
 * Runs every minute.
 */
async function autoTransitionEvents() {
  const now = new Date();

  // 1. Transition 'draft' to 'registration'
  const draftEvents = await Event.find({ status: 'draft', registrationOpen: { $ne: null, $lte: now } });
  for (const event of draftEvents) {
    const activeEvent = await Event.findOne({
      _id: { $ne: event._id },
      status: { $in: ['registration', 'prepare', 'ongoing'] }
    });

    if (!activeEvent) {
      event.status = 'registration';
      await event.save();
      console.log(`[CRON] Event "${event.name}" automatically transitioned from draft to registration.`);
    } else {
      console.log(`[CRON] Event "${event.name}" registrationOpen reached, but active event "${activeEvent.name}" prevents transition.`);
    }
  }

  // 2. Transition 'registration' to 'prepare' (when registrationClose is reached)
  const registrationEventsToPrepare = await Event.find({
    status: 'registration',
    registrationClose: { $ne: null, $lte: now }
  });
  for (const event of registrationEventsToPrepare) {
    event.status = 'prepare';
    await event.save();
    console.log(`[CRON] Event "${event.name}" automatically transitioned from registration to prepare.`);
  }

  // 3. Transition 'registration' or 'prepare' to 'ongoing' (when contestStart is reached)
  const ongoingEventsToStart = await Event.find({
    status: { $in: ['registration', 'prepare'] },
    contestStart: { $ne: null, $lte: now }
  });
  for (const event of ongoingEventsToStart) {
    event.status = 'ongoing';
    await event.save();
    console.log(`[CRON] Event "${event.name}" automatically transitioned to ongoing.`);
  }

  // 4. Transition 'ongoing' to 'completed'
  const ongoingEvents = await Event.find({ status: 'ongoing', contestEnd: { $ne: null, $lte: now } });
  for (const event of ongoingEvents) {
    event.status = 'completed';
    await event.save();
    console.log(`[CRON] Event "${event.name}" automatically transitioned from ongoing to completed.`);
  }
}

/**
 * Checks all active repositories and syncs those whose commit sync interval is due.
 */
async function checkAndSyncDueRepositories() {
  const activeRepos = await GithubRepository.find({ isArchived: false });
  
  const concurrencyLimit = 3;
  const executing = [];

  for (const repo of activeRepos) {
    // Skip if already syncing in the last 5 minutes to prevent race conditions
    if (repo.syncStatus === 'syncing') {
      const lastUpdated = repo.updatedAt ? new Date(repo.updatedAt).getTime() : 0;
      const elapsedMinutes = (Date.now() - lastUpdated) / (1000 * 60);
      if (elapsedMinutes < 5) {
        console.log(`[CRON] Repo ${repo.repoName} is already syncing. Skipping.`);
        continue;
      }
    }

    console.log(`[CRON] Scanning repo ${repo.repoName} for new commits...`);
    const p = (async () => {
      try {
        if (githubAiQueue.isQueueAvailable()) {
          await githubAiQueue.addSyncJob(repo._id.toString());
        } else {
          await syncRepo(repo._id);
        }
      } catch (err) {
        console.error(`[CRON ERROR] Failed syncing repo ID ${repo._id}:`, err.message);
      }
    })();

    executing.push(p);

    const clean = () => {
      const idx = executing.indexOf(p);
      if (idx > -1) executing.splice(idx, 1);
    };
    p.then(clean, clean);

    if (executing.length >= concurrencyLimit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}

/**
 * Initializes cron jobs for the system
 */
function startCronJobs() {
  console.log('[CRON] Initializing background task schedulers...');

  // Schedule to run every 1 minute: '* * * * *'
  cron.schedule('* * * * *', async () => {
    try {
      await autoTransitionEvents();
    } catch (error) {
      console.error('[CRON ERROR] Failed to auto transition event status:', error.message);
    }
    
    try {
      await checkAndSyncDueRepositories();
    } catch (error) {
      console.error('[CRON ERROR] Failed to check and sync due repositories:', error.message);
    }

    try {
      await distributeRoundExamMaterials();
      await distributeTrackTopics();
    } catch (error) {
      console.error('[CRON ERROR] Failed to distribute exam materials:', error.message);
    }
  });

  console.log('[CRON] Background task scheduler started. Repo sync check and event auto-transition scheduled for every minute.');
}

/**
 * Syncs all active repositories in the database
 */
async function syncAllRepositories() {
  const activeRepos = await GithubRepository.find({ isArchived: false });
  console.log(`[CRON] Syncing ${activeRepos.length} repository/repositories...`);

  if (githubAiQueue.isQueueAvailable()) {
    // If BullMQ queue is active, enqueue all sync jobs. The sequential worker will throttle execution.
    for (const repo of activeRepos) {
      try {
        await githubAiQueue.addSyncJob(repo._id.toString());
      } catch (err) {
        console.error(`[CRON ERROR] Failed to enqueue repo ID ${repo._id}:`, err.message);
      }
    }
  } else {
    // Fallback sequential execution with a 12-second cooldown to stay under Gemini 5 RPM rate limit
    for (const repo of activeRepos) {
      try {
        await syncRepo(repo._id);
        console.log('[CRON] Fallback sync cooldown sleep for 12 seconds...');
        await new Promise(resolve => setTimeout(resolve, 12000));
      } catch (err) {
        console.error(`[CRON ERROR] Failed syncing repo ID ${repo._id}:`, err.message);
      }
    }
  }

  console.log('[CRON] All repositories sync processes completed.');
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

      // Perform a single combined AI analysis call (only 1 n8n/AI request!)
      try {
        console.log(`[SYNC] Running combined sync AI analysis (commit + team aggregate) for team: ${repo.teamId}...`);
        
        // Fetch up to 200 commits for the team
        const allTeamCommits = await Commit.find({ teamId: repo.teamId }).sort({ committedAt: 1 }).limit(200);
        // Fetch up to 40 prior reviews
        const priorReviews = await AiAnalysis.find({
          teamId: repo.teamId,
          analysisType: 'commit_review',
          status: 'completed'
        }).sort({ createdAt: -1 }).limit(40);

        const combinedResult = await aiService.analyzeCommitAndAggregate(
          batchCommit,
          batchFiles,
          repo.teamId,
          allTeamCommits,
          priorReviews
        );

        const aiResult = combinedResult.commit_review;
        const aggResult = combinedResult.repository_review;

        // 1. Save Per-Push Commit Review
        if (aiResult) {
          const aiAnalysis = new AiAnalysis({
            repositoryId: repo._id,
            teamId: repo.teamId,
            commitId: latestCommit._id,
            analysisType: 'commit_review',
            provider: combinedResult._provider || aiResult._provider || 'Google Gemini',
            model: combinedResult._model || aiResult._model || 'gemini-3.1-flash-lite',
            result: aiResult,
            status: 'completed',
            completedAt: new Date()
          });
          await aiAnalysis.save();

          // Update latest commit with summary
          latestCommit.diffSummary = aiResult.overall_picture?.push_summary || aiResult.summary || '';
          await latestCommit.save();

          console.log(`[SYNC] Completed per-push AI analysis successfully.`);

          // Auto-create GitHub Issue when significant change is detected
          if (aiResult.overall_picture?.significant_change === true || aiResult.significant_change === true) {
            const title = `[Gemini AI] Phát hiện thay đổi quan trọng trong mã nguồn`;
            const body = `### Phân tích Thay đổi Quan trọng từ Gemini AI

Chúng tôi phát hiện một số thay đổi quan trọng trong mã nguồn thông qua các commit gần đây:

**Tóm tắt thay đổi:**
${aiResult.overall_picture?.push_summary || aiResult.summary || 'Không có tóm tắt.'}

**Tiêu điểm hiện tại:**
${aiResult.overall_picture?.current_focus || 'Không có thông tin.'}

**Kiến trúc / Công nghệ:**
- RAG Maturity: ${aiResult.rag_maturity?.level || 'Chưa rõ'}
- Động cơ suy luận: ${aiResult.agent_intelligence?.reasoning_pattern || 'Không có'}
- Mô hình LLM: ${(aiResult.tech_stack?.llm_models || []).join(', ') || 'Không rõ'}

**Đánh giá nhanh:**
- **Ưu điểm:**
${aiResult.assessment?.advantages || 'Không có thông tin.'}
- **Hạn chế & Rủi ro:**
${aiResult.assessment?.disadvantages || 'Không có thông tin.'}
- **Các khu vực cần cải thiện:**
${aiResult.assessment?.improvement_areas || 'Không có thông tin.'}

---
*Thông báo này được tạo tự động bởi hệ thống Seal Hackathon khi phát hiện thay đổi quan trọng.*`;

            console.log(`[SYNC] Significant change detected. Auto-creating GitHub Issue on repo ${repo.repoName}...`);
            const issue = await githubService.createIssue(repo.repoName, title, body, repo.orgName);
            if (issue) {
              aiResult.github_issue_url = issue.html_url;
              aiAnalysis.result = aiResult;
              aiAnalysis.markModified('result');
              await aiAnalysis.save();
            }
          }
        }

        // 2. Save Team Aggregate Review
        if (aggResult) {
          const aggAnalysis = new AiAnalysis({
            repositoryId: repo._id,
            teamId: repo.teamId,
            analysisType: 'repository_review', // Maps to team_aggregate
            provider: combinedResult._provider || aggResult._provider || 'Google Gemini',
            model: combinedResult._model || aggResult._model || 'gemini-3.1-flash-lite',
            result: aggResult,
            status: 'completed',
            completedAt: new Date()
          });
          await aggAnalysis.save();
          console.log(`[SYNC] Completed Team Aggregate AI review successfully.`);
        }

      } catch (aiErr) {
        console.error(`[SYNC] Combined AI sync analysis failed:`, aiErr.message);
        
        // Save failed records for troubleshooting
        try {
          const aiAnalysisFailed = new AiAnalysis({
            repositoryId: repo._id,
            teamId: repo.teamId,
            commitId: latestCommit._id,
            analysisType: 'commit_review',
            status: 'failed',
            errorMessage: aiErr.message
          });
          await aiAnalysisFailed.save();
        } catch (dbErr) {
          console.error(`[SYNC] Failed saving error log for commit review:`, dbErr.message);
        }

        try {
          const aggAnalysisFailed = new AiAnalysis({
            repositoryId: repo._id,
            teamId: repo.teamId,
            analysisType: 'repository_review',
            status: 'failed',
            errorMessage: aiErr.message
          });
          await aggAnalysisFailed.save();
        } catch (dbErr) {
          console.error(`[SYNC] Failed saving error log for team aggregate review:`, dbErr.message);
        }
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

/**
 * When round startTime is reached: sync Drive permissions + notify participants.
 */
async function distributeRoundExamMaterials() {
  const now = new Date();
  const Round = mongoose.model('Round');
  const Notification = mongoose.model('Notification');
  const emailService = require('../notifications/emailService');
  const { syncDriveAccessForRound } = require('./driveAccessService');
  const { getEligibleUserIdsForRound } = require('./examAccessService');
  const { addInAppJob, isQueueAvailable } = require('../notifications/notificationQueue');

  const pendingRounds = await Round.find({
    driveFileId: { $ne: null },
    startTime: { $ne: null, $lte: now },
    isNotificationSent: { $ne: true }
  });

  for (const round of pendingRounds) {
    console.log(`[CRON] Round "${round.name}" startTime reached. Syncing Drive + notifying participants...`);

    let syncResult;
    try {
      syncResult = await syncDriveAccessForRound(round._id);
    } catch (syncErr) {
      console.error(`[CRON ERROR] Drive sync for round ${round._id}:`, syncErr.message);
      continue;
    }

    if (syncResult.failed?.length > 0) {
      console.warn(`[CRON] Round "${round.name}": ${syncResult.failed.length} email(s) failed Drive share — will retry next cron cycle.`);
      continue;
    }

    const userIds = await getEligibleUserIdsForRound(round._id);
    const users = await mongoose.model('User').find({ _id: { $in: userIds } }).select('email fullName');

    for (const user of users) {
      const notifTitle = `Đề thi vòng "${round.name}" đã được mở!`;
      const notifBody = `Vòng "${round.name}" đã bắt đầu. Vào Khu vực đội → Mở đề & tài liệu (cần email Google trùng email đăng ký).`;

      try {
        if (isQueueAvailable()) {
          await addInAppJob({
            userId: user._id.toString(),
            type: 'round_exam_opened',
            title: notifTitle,
            body: notifBody
          });
        } else {
          await new Notification({
            userId: user._id,
            type: 'round_exam_opened',
            title: notifTitle,
            body: notifBody,
            channel: 'in_app',
            status: 'sent'
          }).save();
        }
      } catch (notifErr) {
        console.error(`[CRON ERROR] Notification to ${user._id}:`, notifErr.message);
      }

      try {
        await emailService.sendRoundExamOpened(user.email, user.fullName, round.name);
      } catch (emailErr) {
        console.error(`[CRON ERROR] Email to ${user.email}:`, emailErr.message);
      }
    }

    round.isNotificationSent = true;
    await round.save();
    console.log(`[CRON] Round "${round.name}" exam distribution completed (${users.length} users).`);
  }
}

/**
 * Legacy track-level distribution (deprecated — kept for old data).
 */
async function distributeTrackTopics() {
  const now = new Date();
  const Track = mongoose.model('Track');
  const Team = mongoose.model('Team');
  const TeamMember = mongoose.model('TeamMember');
  const Notification = mongoose.model('Notification');
  const emailService = require('../notifications/emailService');
  const { addInAppJob, isQueueAvailable } = require('../notifications/notificationQueue');

  // Find tracks where startTime has started and attachments haven't been distributed yet
  const pendingTracks = await Track.find({
    startTime: { $ne: null, $lte: now },
    isAttachmentSent: { $ne: true }
  });

  for (const track of pendingTracks) {
    console.log(`[CRON] Track "${track.name}" startTime reached. Distributing topics/materials to teams...`);

    // Find confirmed teams for this track
    const teams = await Team.find({ trackId: track._id, status: 'confirmed' });
    
    for (const team of teams) {
      // Find all confirmed members of the team
      const members = await TeamMember.find({ teamId: team._id, confirmStatus: 'confirmed' }).populate('userId');
      
      for (const member of members) {
        if (!member.userId) continue;

        const user = member.userId;
        const attachmentsList = track.attachments || [];

        // Send in-app notification
        const notifTitle = `Đề thi & tài liệu bảng đấu "${track.name}" đã được mở!`;
        const notifBody = `Đề thi cho bảng đấu "${track.name}" đã bắt đầu. Hãy kiểm tra dashboard [ĐỀ_BÀI_&_TÀI_LIỆU_THI] để lấy đề bài và tài liệu làm bài!`;
        
        try {
          if (isQueueAvailable()) {
            await addInAppJob({
              userId: user._id.toString(),
              type: 'track_topic_opened',
              title: notifTitle,
              body: notifBody,
            });
          } else {
            await new Notification({
              userId: user._id,
              type: 'track_topic_opened',
              title: notifTitle,
              body: notifBody,
              channel: 'in_app',
              status: 'sent',
            }).save();
          }
        } catch (notifErr) {
          console.error(`[CRON ERROR] Failed to send in-app notification to user ${user._id}:`, notifErr.message);
        }

        // Send email notification
        try {
          await emailService.sendTrackTopicDistribution(user.email, user.fullName, track.name, attachmentsList);
        } catch (emailErr) {
          console.error(`[CRON ERROR] Failed to send email to ${user.email}:`, emailErr.message);
        }
      }
    }

    // Mark track as distributed
    track.isAttachmentSent = true;
    await track.save();
    console.log(`[CRON] Track "${track.name}" attachments distributed successfully.`);
  }
}

module.exports = {
  startCronJobs,
  syncRepo,
  syncAllRepositories,
  distributeRoundExamMaterials,
  distributeTrackTopics
};
