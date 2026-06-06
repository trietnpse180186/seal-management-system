const mongoose = require('mongoose');
require('dotenv').config();

// Load models
require('./models/User');
require('./models/Event');
require('./models/Track');
require('./models/Round');
require('./models/Team');
require('./models/TeamMember');
require('./models/Rubric');
require('./models/Criterion');
require('./models/GithubRepository');
require('./models/Commit');
require('./models/AiAnalysis');
require('./models/EventRole');

async function runSetup() {
  console.log('=== KHIÊU KHỞI TẠO EVENT MỚI, 2 ROUNDS, 4 TRACKS, 20 TEAMS, RUBRICS VÀ COMMITS ===');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';
  console.log(`Kết nối MongoDB: ${mongoUri}`);
  await mongoose.connect(mongoUri);
  console.log('Đã kết nối thành công.');

  const User = mongoose.model('User');
  const Event = mongoose.model('Event');
  const Round = mongoose.model('Round');
  const Track = mongoose.model('Track');
  const Team = mongoose.model('Team');
  const TeamMember = mongoose.model('TeamMember');
  const Rubric = mongoose.model('Rubric');
  const Criterion = mongoose.model('Criterion');
  const GithubRepository = mongoose.model('GithubRepository');
  const Commit = mongoose.model('Commit');
  const AiAnalysis = mongoose.model('AiAnalysis');
  const EventRole = mongoose.model('EventRole');

  // 1. Xóa Event cũ (nếu có trùng lặp)
  console.log('\nDọn dẹp event demo Fall 2026 cũ nếu có...');
  const oldEvent = await Event.findOne({ semester: 'Fall', year: 2026 });
  if (oldEvent) {
    console.log(`Tìm thấy event cũ: "${oldEvent.name}" (ID: ${oldEvent._id}). Đang dọn dẹp...`);
    // Xóa rounds, tracks, rubrics, criteria, teams, members, repos, commits, ai reviews liên quan
    const rounds = await Round.find({ eventId: oldEvent._id });
    const roundIds = rounds.map(r => r._id);

    const tracks = await Track.find({ eventId: oldEvent._id });
    const trackIds = tracks.map(t => t._id);

    const teams = await Team.find({ eventId: oldEvent._id });
    const teamIds = teams.map(t => t._id);

    await Rubric.deleteMany({ eventId: oldEvent._id });
    await Criterion.deleteMany({ rubricId: { $in: await Rubric.find({ eventId: oldEvent._id }).select('_id') } });
    await Commit.deleteMany({ teamId: { $in: teamIds } });
    await GithubRepository.deleteMany({ eventId: oldEvent._id });
    await AiAnalysis.deleteMany({ teamId: { $in: teamIds } });
    await TeamMember.deleteMany({ teamId: { $in: teamIds } });
    await EventRole.deleteMany({ eventId: oldEvent._id });
    await Team.deleteMany({ eventId: oldEvent._id });
    await Track.deleteMany({ eventId: oldEvent._id });
    await Round.deleteMany({ eventId: oldEvent._id });
    await Event.deleteOne({ _id: oldEvent._id });
    console.log('Đã dọn dẹp sạch sẽ dữ liệu của event cũ.');
  }

  // 2. Tạo Event mới
  console.log('\nTạo Event mới (SEAL Hackathon Fall 2026)...');
  const event = new Event({
    name: 'SEAL Hackathon Fall 2026',
    semester: 'Fall',
    year: 2026,
    description: 'Giải đấu Hackathon lớn nhất mùa thu năm 2026 dành cho các lập trình viên.',
    status: 'ongoing',
    maxTeams: 50,
    githubOrgName: 'seal-hackathon-fall-2026'
  });
  await event.save();
  console.log(`- Đã tạo Event: "${event.name}" (ID: ${event._id})`);

  // 3. Tạo 2 Round
  console.log('\nTạo 2 Round đấu...');
  const round1 = new Round({
    eventId: event._id,
    name: 'Vòng sơ tuyển (Round 1)',
    order: 1,
    status: 'active',
    submissionDeadline: new Date(Date.now() + 3600000 * 24 * 7), // 7 days from now
    advanceTopN: 10
  });
  await round1.save();
  console.log(`- Đã tạo Round 1: "${round1.name}" (ID: ${round1._id})`);

  const round2 = new Round({
    eventId: event._id,
    name: 'Vòng chung kết (Round 2)',
    order: 2,
    status: 'pending',
    submissionDeadline: new Date(Date.now() + 3600000 * 24 * 14), // 14 days from now
    advanceTopN: 5
  });
  await round2.save();
  console.log(`- Đã tạo Round 2: "${round2.name}" (ID: ${round2._id})`);

  // 4. Tạo 2 Track dưới mỗi Round
  console.log('\nTạo 2 Track dưới mỗi Round...');
  // Tracks cho Round 1
  const trackA1 = new Track({
    eventId: event._id,
    roundId: round1._id,
    name: 'Bảng A1 - Phát triển Web (Vòng sơ tuyển)',
    description: 'Phát triển các ứng dụng web tối ưu hiệu năng và trải nghiệm.',
    maxTeams: 15
  });
  await trackA1.save();
  console.log(`- Đã tạo Track A1: "${trackA1.name}" (ID: ${trackA1._id})`);

  const trackA2 = new Track({
    eventId: event._id,
    roundId: round1._id,
    name: 'Bảng A2 - Ứng dụng Di động (Vòng sơ tuyển)',
    description: 'Phát triển các ứng dụng di động đa nền tảng.',
    maxTeams: 15
  });
  await trackA2.save();
  console.log(`- Đã tạo Track A2: "${trackA2.name}" (ID: ${trackA2._id})`);

  // Tracks cho Round 2
  const trackB1 = new Track({
    eventId: event._id,
    roundId: round2._id,
    name: 'Bảng B1 - Web Dev xuất sắc (Chung kết)',
    description: 'Chung kết tranh tài bảng Web.',
    maxTeams: 10
  });
  await trackB1.save();
  console.log(`- Đã tạo Track B1: "${trackB1.name}" (ID: ${trackB1._id})`);

  const trackB2 = new Track({
    eventId: event._id,
    roundId: round2._id,
    name: 'Bảng B2 - Mobile App xuất sắc (Chung kết)',
    description: 'Chung kết tranh tài bảng Mobile.',
    maxTeams: 10
  });
  await trackB2.save();
  console.log(`- Đã tạo Track B2: "${trackB2.name}" (ID: ${trackB2._id})`);

  // 5. Tạo Rubrics và Criteria
  console.log('\nTạo Rubric và Criteria cho từng Round...');
  
  // Rubric cho Round 1
  const rubric1 = new Rubric({
    eventId: event._id,
    trackId: trackA1._id, // Gắn với track đầu tiên làm tham chiếu
    roundId: round1._id,
    name: 'Rubric Đánh giá Vòng sơ tuyển',
    description: 'Tiêu chuẩn chấm điểm các dự án tại Vòng sơ tuyển.',
    totalWeight: 100,
    maxCriterionScore: 10,
    isActive: true,
    isLocked: true
  });
  await rubric1.save();
  console.log(`- Đã tạo Rubric 1: "${rubric1.name}" (ID: ${rubric1._id})`);

  const crit1_1 = new Criterion({
    rubricId: rubric1._id,
    code: 'CODE',
    name: 'Chất lượng mã nguồn (Code Quality)',
    description: 'Cấu trúc thư mục sạch sẽ, áp dụng Clean Code, tối ưu hóa.',
    weight: 60,
    maxScore: 10
  });
  await crit1_1.save();

  const crit1_2 = new Criterion({
    rubricId: rubric1._id,
    code: 'TEAM',
    name: 'Tương tác Git (Git Collaboration)',
    description: 'Phân phối nhánh hợp lý, tần suất commit đều đặn giữa các thành viên.',
    weight: 40,
    maxScore: 10
  });
  await crit1_2.save();
  console.log('  + Đã tạo 2 tiêu chí cho Rubric Vòng sơ tuyển (CODE: 60%, TEAM: 40%).');

  // Rubric cho Round 2
  const rubric2 = new Rubric({
    eventId: event._id,
    trackId: trackB1._id,
    roundId: round2._id,
    name: 'Rubric Đánh giá Chung kết',
    description: 'Tiêu chuẩn chấm điểm tranh giải chung kết.',
    totalWeight: 100,
    maxCriterionScore: 10,
    isActive: true,
    isLocked: true
  });
  await rubric2.save();
  console.log(`- Đã tạo Rubric 2: "${rubric2.name}" (ID: ${rubric2._id})`);

  const crit2_1 = new Criterion({
    rubricId: rubric2._id,
    code: 'CODE',
    name: 'Chất lượng sản phẩm & Logic',
    description: 'Sản phẩm chạy mượt mà, đầy đủ chức năng cốt lõi và không lỗi.',
    weight: 50,
    maxScore: 10
  });
  await crit2_1.save();

  const crit2_2 = new Criterion({
    rubricId: rubric2._id,
    code: 'PRESENTATION',
    name: 'Thuyết trình & Demo',
    description: 'Thuyết trình lưu loát, trả lời tốt câu hỏi phản biện của giám khảo.',
    weight: 50,
    maxScore: 10
  });
  await crit2_2.save();
  console.log('  + Đã tạo 2 tiêu chí cho Rubric Chung kết (CODE: 50%, PRESENTATION: 50%).');

  // Gán vai trò coordinator và judge cho tất cả người dùng trong hệ thống
  console.log('\nGán vai trò coordinator và judge cho tất cả người dùng trong hệ thống...');
  const users = await User.find({});
  for (const u of users) {
    const coordRole = new EventRole({
      userId: u._id,
      eventId: event._id,
      role: 'coordinator',
      status: 'active'
    });
    await coordRole.save();

    const judgeRole = new EventRole({
      userId: u._id,
      eventId: event._id,
      role: 'judge',
      status: 'active'
    });
    await judgeRole.save();
  }
  console.log(`- Đã gán vai trò cho ${users.length} người dùng.`);

  // 6. Tạo 20 đội thi (5 đội/track)
  console.log('\nTạo 20 đội thi và gán vào 4 track (mỗi track 5 đội)...');
  const distribution = [
    { track: trackA1, round: round1 },
    { track: trackA2, round: round1 },
    { track: trackB1, round: round2 },
    { track: trackB2, round: round2 }
  ];

  const suffix = Date.now().toString().slice(-4);
  let globalTeamIndex = 1;

  for (let d = 0; d < distribution.length; d++) {
    const { track, round } = distribution[d];
    console.log(`\nThiết lập 5 đội cho Bảng: "${track.name}" (${round.name}):`);

    for (let count = 1; count <= 5; count++) {
      // a. Tạo tài khoản Leader
      const email = `leader-${globalTeamIndex}-${suffix}@example.com`;
      const passwordHash = 'e10adc3949ba59abbe56e057f20f883e'; // '123456'
      
      const leaderUser = new User({
        email,
        passwordHash,
        fullName: `Leader Đội ${globalTeamIndex} (${suffix})`,
        githubUsername: `leader-git-${globalTeamIndex}-${suffix}`,
        isApproved: true
      });
      await leaderUser.save();

      // b. Tạo Đội thi
      const team = new Team({
        eventId: event._id,
        leaderId: leaderUser._id,
        name: `Đội chiến binh ${globalTeamIndex} (${suffix})`,
        trackId: track._id,
        currentRoundId: round._id,
        status: 'confirmed'
      });
      await team.save();

      // c. Tạo thành viên nhóm trưởng
      const member = new TeamMember({
        teamId: team._id,
        userId: leaderUser._id,
        role: 'leader',
        confirmStatus: 'confirmed',
        confirmedAt: new Date()
      });
      await member.save();

      console.log(`  + Đội "${team.name}" (ID: ${team._id}) -> Leader: ${email}`);

      // d. Tạo Repo GitHub cho đội
      const repoName = `seal-hack-fall-repo-${globalTeamIndex}`;
      const repo = new GithubRepository({
        eventId: event._id,
        trackId: track._id,
        teamId: team._id,
        orgName: event.githubOrgName,
        repoName: repoName,
        repoUrl: `https://github.com/${event.githubOrgName}/${repoName}`,
        githubRepoId: `repo-git-id-${team._id}`,
        defaultBranch: 'main',
        syncStatus: 'success',
        lastSyncedAt: new Date()
      });
      await repo.save();
      console.log(`    * Đã tạo Git Repo: "${repo.repoName}"`);

      // e. Tạo 3 Commit cho Repo này
      const commitMessages = [
        { msg: 'feat: initialize boilerplates and routing configuration', offset: 3600000 * 24 * 4 },
        { msg: 'feat: design interactive layout with premium sidebar styling', offset: 3600000 * 24 * 2 },
        { msg: 'fix: correct state validation and optimize dashboard metrics rendering', offset: 3600000 * 3 }
      ];

      for (let c = 0; c < commitMessages.length; c++) {
        const commitInfo = commitMessages[c];
        const commitSha = `sha-${c + 1}-${team._id.toString().slice(-6)}-${Math.random().toString(36).substring(2, 6)}`;
        
        const commit = new Commit({
          repositoryId: repo._id,
          teamId: team._id,
          commitSha: commitSha,
          branch: 'main',
          authorGithubUsername: leaderUser.githubUsername,
          authorName: leaderUser.fullName,
          authorEmail: leaderUser.email,
          message: commitInfo.msg,
          commitUrl: `${repo.repoUrl}/commit/${commitSha}`,
          additions: Math.floor(Math.random() * 80) + 20,
          deletions: Math.floor(Math.random() * 30) + 5,
          changedFilesCount: Math.floor(Math.random() * 4) + 1,
          committedAt: new Date(Date.now() - commitInfo.offset),
          pulledAt: new Date(),
          diffFetched: true,
          diffSummary: `diff --git a/src/App.jsx b/src/App.jsx\nindex abc123..def456 100644\n--- a/src/App.jsx\n+++ b/src/App.jsx\n@@ -1,5 +1,9 @@\n`
        });
        await commit.save();

        // f. Tạo AI Review cho commit này
        const aiAnalysis = new AiAnalysis({
          repositoryId: repo._id,
          teamId: team._id,
          roundId: round._id,
          commitId: commit._id,
          analysisType: 'commit_review',
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          status: 'completed',
          result: {
            qualitativeComments: `This commit is clean and well-structured. The code shifts logical components into reusable files, which matches best practices.`,
            scores: {
              codeQuality: Math.floor(Math.random() * 4) + 7, // 7 to 10
              adherence: Math.floor(Math.random() * 3) + 8 // 8 to 10
            },
            suggestedRefactoring: "No urgent refactoring needed. Keep files small."
          },
          errorMessage: null,
          completedAt: new Date()
        });
        await aiAnalysis.save();
      }
      console.log(`    * Đã tạo 3 Mock Commits & AI Reviews cho đội này.`);
      globalTeamIndex++;
    }
  }

  console.log('\n=== HÀNH TRÌNH TẠO MOCK DATA HOÀN THÀNH RỰC RỠ ===');
  await mongoose.disconnect();
}

runSetup().catch(err => {
  console.error('Lỗi khi chạy script:', err);
  mongoose.disconnect();
});
