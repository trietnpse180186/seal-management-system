const mongoose = require('mongoose');
require('dotenv').config();

// Require models
require('./models/User');
require('./models/Event');
require('./models/Track');
require('./models/Team');
require('./models/GithubRepository');
require('./models/Commit');
require('./models/AiAnalysis');

async function createMockCommits() {
  console.log('=== KHIÊU KHỞI TẠO COMMITS GIT VÀ REVIEW AI ĐỂ XEM DEMO ===');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';
  console.log(`Kết nối MongoDB: ${mongoUri}`);
  await mongoose.connect(mongoUri);
  console.log('Đã kết nối.');

  const Event = mongoose.model('Event');
  const Team = mongoose.model('Team');
  const GithubRepository = mongoose.model('GithubRepository');
  const Commit = mongoose.model('Commit');
  const AiAnalysis = mongoose.model('AiAnalysis');

  // Tìm cuộc thi mới nhất
  const event = await Event.findOne().sort({ _id: -1 });
  if (!event) {
    console.error('Lỗi: Không tìm thấy cuộc thi nào.');
    await mongoose.disconnect();
    return;
  }
  console.log(`Sự kiện đích: "${event.name}" (ID: ${event._id})`);

  // Tìm tất cả các đội thi đã confirmed trong sự kiện này
  const teams = await Team.find({ eventId: event._id, status: 'confirmed' });
  console.log(`Tìm thấy ${teams.length} đội thi đã xác nhận.`);

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    console.log(`\nThiết lập dữ liệu Git cho Đội: "${team.name}" (ID: ${team._id})`);

    // 1. Dọn dẹp Repo & Commits cũ của đội này
    await GithubRepository.deleteMany({ teamId: team._id });
    await Commit.deleteMany({ teamId: team._id });
    await AiAnalysis.deleteMany({ teamId: team._id });

    // 2. Tạo GithubRepository cho đội
    const repoName = `seal-hackathon-repo-${team.name.replace(/\s+/g, '-').replace(/[()]/g, '').toLowerCase()}`;
    const repo = new GithubRepository({
      eventId: event._id,
      trackId: team.trackId,
      teamId: team._id,
      orgName: event.githubOrgName || 'seal-hackathon',
      repoName: repoName,
      repoUrl: `https://github.com/${event.githubOrgName || 'seal-hackathon'}/${repoName}`,
      githubRepoId: `git-id-${team._id}`,
      defaultBranch: 'main',
      syncStatus: 'success',
      lastSyncedAt: new Date()
    });
    await repo.save();
    console.log(`- Đã tạo Repo: "${repo.repoName}" (ID: ${repo._id})`);

    // 3. Tạo 3 Mock Commits cho Repo này
    const commitMessages = [
      { msg: 'feat: initialize project layout and configure vite with tailwindcss', offset: 3600000 * 24 * 3 }, // 3 ngày trước
      { msg: 'feat: implement core landing screen and bento statistics cards', offset: 3600000 * 24 * 1.5 }, // 1.5 ngày trước
      { msg: 'fix: resolve layout shift and responsiveness issues on mobile viewports', offset: 3600000 * 4 } // 4 giờ trước
    ];

    for (let c = 0; c < commitMessages.length; c++) {
      const commitInfo = commitMessages[c];
      const commitSha = `sha-${c + 1}-${team._id.toString().slice(-6)}-${Math.random().toString(36).substring(2, 6)}`;
      
      const commit = new Commit({
        repositoryId: repo._id,
        teamId: team._id,
        commitSha: commitSha,
        branch: 'main',
        authorGithubUsername: `mock-git-leader-${i + 1}`,
        authorName: `Mock Leader ${i + 1}`,
        authorEmail: `mock-leader-${i + 1}@example.com`,
        message: commitInfo.msg,
        commitUrl: `${repo.repoUrl}/commit/${commitSha}`,
        additions: Math.floor(Math.random() * 100) + 15,
        deletions: Math.floor(Math.random() * 40) + 5,
        changedFilesCount: Math.floor(Math.random() * 5) + 1,
        committedAt: new Date(Date.now() - commitInfo.offset),
        pulledAt: new Date(),
        diffFetched: true,
        diffSummary: `diff --git a/src/App.jsx b/src/App.jsx\nindex abc123..def456 100644\n--- a/src/App.jsx\n+++ b/src/App.jsx\n@@ -1,5 +1,9 @@\n`
      });
      await commit.save();
      console.log(`  + Đã tạo Commit ${c + 1}: [${commitSha.slice(0, 8)}] "${commit.message}"`);

      // 4. Tạo AI review tương ứng cho commit này
      const aiAnalysis = new AiAnalysis({
        repositoryId: repo._id,
        teamId: team._id,
        roundId: team.currentRoundId,
        commitId: commit._id,
        analysisType: 'commit_review',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        status: 'completed',
        result: {
          qualitativeComments: `This commit is excellent. The code changes in mock files are modular and standard. It resolves responsibilities neatly.`,
          scores: {
            codeQuality: Math.floor(Math.random() * 3) + 7, // 7 to 9
            adherence: Math.floor(Math.random() * 3) + 8 // 8 to 10
          },
          suggestedRefactoring: "Consider exporting the helper functions to a utils module to avoid component bloating."
        },
        errorMessage: null,
        completedAt: new Date()
      });
      await aiAnalysis.save();
      console.log(`    * Đã tạo AI Review tương ứng cho Commit này.`);
    }
  }

  console.log('\n=== ĐÃ HOÀN THÀNH KHIÊU KHỞI TẠO DỮ LIỆU COMMITS VÀ AI REVIEW ===');
  await mongoose.disconnect();
}

createMockCommits().catch(err => {
  console.error('Lỗi khi chạy script:', err);
  mongoose.disconnect();
});
