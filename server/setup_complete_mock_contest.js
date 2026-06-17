const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Require all models to ensure Mongoose registers them
require('./features/auth/User');
require('./features/events/Event');
require('./features/events/Track');
require('./features/events/Round');
require('./features/auth/EventRole');
require('./features/teams/Team');
require('./features/teams/TeamMember');
require('./features/github-ai/GithubRepository');
require('./features/github-ai/Commit');
require('./features/github-ai/CommitFile');
require('./features/github-ai/AiAnalysis');
require('./features/grading/Rubric');
require('./features/grading/Criterion');
require('./features/grading/Score');
require('./features/grading/ScoreDetail');
require('./features/grading/Ranking');

async function setupCompleteMockContest() {
  console.log('=== KHỞI TẠO TOÀN BỘ DỮ LIỆU CUỘC THI MOCK (EVENT -> ROLES -> RUBRICS -> TEAMS -> REPOS -> COMMITS -> SCORES -> RANKINGS) ===');

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';
  console.log(`Kết nối MongoDB: ${mongoUri}`);
  await mongoose.connect(mongoUri);
  console.log('Đã kết nối MongoDB thành công.');

  const User = mongoose.model('User');
  const Event = mongoose.model('Event');
  const Round = mongoose.model('Round');
  const Track = mongoose.model('Track');
  const EventRole = mongoose.model('EventRole');
  const Team = mongoose.model('Team');
  const TeamMember = mongoose.model('TeamMember');
  const GithubRepository = mongoose.model('GithubRepository');
  const Commit = mongoose.model('Commit');
  const CommitFile = mongoose.model('CommitFile');
  const AiAnalysis = mongoose.model('AiAnalysis');
  const Rubric = mongoose.model('Rubric');
  const Criterion = mongoose.model('Criterion');
  const Score = mongoose.model('Score');
  const ScoreDetail = mongoose.model('ScoreDetail');
  const Ranking = mongoose.model('Ranking');

  const suffix = Date.now().toString().slice(-4);

  // 1. Dọn dẹp dữ liệu cũ của kì học Fall 2026
  console.log('\n[1/8] Dọn dẹp dữ liệu cũ (Fall 2026)...');
  const oldEvents = await Event.find({ semester: 'Fall', year: 2026 });
  for (const oldEvent of oldEvents) {
    console.log(`- Đang xóa dữ liệu liên quan đến sự kiện: "${oldEvent.name}"`);
    const eventId = oldEvent._id;
    const teams = await Team.find({ eventId });
    const teamIds = teams.map(t => t._id);
    const repos = await GithubRepository.find({ eventId });
    const repoIds = repos.map(r => r._id);

    await Rubric.deleteMany({ eventId });
    await Criterion.deleteMany({ rubricId: { $in: await Rubric.find({ eventId }).select('_id') } });
    await Commit.deleteMany({ teamId: { $in: teamIds } });
    await CommitFile.deleteMany({ repositoryId: { $in: repoIds } });
    await GithubRepository.deleteMany({ eventId });
    await AiAnalysis.deleteMany({ teamId: { $in: teamIds } });
    await TeamMember.deleteMany({ teamId: { $in: teamIds } });
    await EventRole.deleteMany({ eventId });
    
    const scores = await Score.find({ eventId });
    const scoreIds = scores.map(s => s._id);
    await ScoreDetail.deleteMany({ scoreId: { $in: scoreIds } });
    await Score.deleteMany({ eventId });
    await Ranking.deleteMany({ eventId });

    await Team.deleteMany({ eventId });
    await Track.deleteMany({ eventId });
    await Round.deleteMany({ eventId });
    await Event.deleteOne({ _id: eventId });
  }

  // Dọn dẹp các tài khoản kiểm thử cũ (email có đuôi @example.com) để tránh rác DB
  console.log('- Dọn dẹp các tài khoản kiểm thử cũ (email @example.com)...');
  const deletedUsers = await User.deleteMany({ email: { $regex: /@example\.com$/i } });
  console.log(`- Đã dọn dẹp xong ${deletedUsers.deletedCount} tài khoản cũ.`);

  // 2. Tạo các tài khoản hệ thống (Admin, Giám khảo, Cố vấn)...
  console.log('\n[2/8] Tạo tài khoản hệ thống (Admin, Giám khảo, Cố vấn)...');
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('123456', salt);

  // Admin
  const adminEmail = `admin-1-${suffix}@example.com`;
  const admin = new User({
    email: adminEmail,
    passwordHash,
    fullName: `System Admin (${suffix})`,
    isSystemAdmin: true,
    isApproved: true,
    isActive: true
  });
  await admin.save();
  console.log(`- Tạo Admin: ${admin.email}`);

  // Judges
  const judges = [];
  for (let j = 1; j <= 2; j++) {
    const judge = new User({
      email: `judge-${j}-${suffix}@example.com`,
      passwordHash,
      fullName: `Giám khảo ${j} (${suffix})`,
      githubUsername: `github-judge-${j}-${suffix}`,
      isApproved: true,
      isActive: true
    });
    await judge.save();
    judges.push(judge);
    console.log(`- Tạo Judge ${j}: ${judge.email}`);
  }

  // Mentors
  const mentors = [];
  for (let m = 1; m <= 2; m++) {
    const mentor = new User({
      email: `mentor-${m}-${suffix}@example.com`,
      passwordHash,
      fullName: `Cố vấn ${m} (${suffix})`,
      githubUsername: `github-mentor-${m}-${suffix}`,
      isApproved: true,
      isActive: true
    });
    await mentor.save();
    mentors.push(mentor);
    console.log(`- Tạo Mentor ${m}: ${mentor.email}`);
  }

  // 3. Tạo một Event đang diễn ra (Ongoing)
  console.log('\n[3/8] Khởi tạo Sự kiện mới (Ongoing)...');
  const event = new Event({
    name: `SEAL Hackathon Championship 2026 (${suffix})`,
    semester: 'Fall',
    year: 2026,
    description: 'Cuộc thi Hackathon lập trình cường độ cao tích hợp đánh giá tự động bằng Trí tuệ nhân tạo Gemini AI.',
    bannerUrl: '/banner.png',
    registrationOpen: new Date(Date.now() - 3600000 * 24 * 5), // 5 ngày trước
    registrationClose: new Date(Date.now() - 3600000 * 24 * 1), // 1 ngày trước
    contestStart: new Date(Date.now() - 3600000 * 4), // 4 giờ trước
    contestEnd: new Date(Date.now() + 3600000 * 44), // Còn 44 giờ thi đấu
    maxTeams: 10,
    githubOrgName: `seal-org-${suffix}`,
    status: 'ongoing'
  });
  await event.save();
  console.log(`- Đã tạo Event: "${event.name}" (ID: ${event._id})`);

  // Tạo các mốc EventRole cho tài khoản hệ thống
  const adminRole = new EventRole({
    userId: admin._id,
    eventId: event._id,
    role: 'coordinator',
    status: 'active',
    assignedBy: admin._id
  });
  await adminRole.save();

  for (const judge of judges) {
    const role = new EventRole({
      userId: judge._id,
      eventId: event._id,
      role: 'judge',
      status: 'active',
      assignedBy: admin._id
    });
    await role.save();
  }

  for (const mentor of mentors) {
    const role = new EventRole({
      userId: mentor._id,
      eventId: event._id,
      role: 'mentor',
      status: 'active',
      assignedBy: admin._id
    });
    await role.save();
  }
  console.log('- Đã phân quyền EventRole (Coordinator/Judge/Mentor) thành công.');

  // 4. Tạo Vòng thi (Round) và Bảng đấu (Tracks)
  console.log('\n[4/8] Tạo Vòng thi (Round) & Bảng đấu (Tracks)...');
  const round = new Round({
    eventId: event._id,
    name: 'Vòng Sơ Loại',
    order: 1,
    status: 'active',
    submissionDeadline: event.contestEnd,
    advanceTopN: 5
  });
  await round.save();
  console.log(`- Đã tạo Round: "${round.name}" (ID: ${round._id})`);

  const trackNames = ['Bảng A - Phát triển Ứng dụng Web', 'Bảng B - Trí tuệ Nhân tạo & Data', 'Bảng C - IoT & Smart Devices'];
  const tracks = [];
  for (const name of trackNames) {
    const t = new Track({
      eventId: event._id,
      roundId: round._id,
      name,
      description: `Bảng thi đấu chính thức thuộc lĩnh vực ${name}`,
      maxTeams: 5
    });
    await t.save();
    tracks.push(t);
  }
  console.log(`- Đã tạo ${tracks.length} Bảng đấu.`);

  // Tạo Rubrics & Criteria chấm điểm
  const rubric = new Rubric({
    eventId: event._id,
    roundId: round._id,
    name: 'Rubric Đánh giá Vòng sơ loại',
    description: 'Tiêu chuẩn chấm điểm các dự án tại Vòng sơ loại.',
    totalWeight: 100,
    maxCriterionScore: 10,
    isActive: true,
    isLocked: true,
    createdBy: admin._id
  });
  await rubric.save();

  const criteria = [
    new Criterion({
      rubricId: rubric._id,
      code: 'CODE',
      name: 'Chất lượng mã nguồn (Code Quality)',
      description: 'Cấu trúc thư mục sạch sẽ, áp dụng Clean Code, tối ưu hóa.',
      weight: 50,
      maxScore: 10,
      order: 1
    }),
    new Criterion({
      rubricId: rubric._id,
      code: 'AI',
      name: 'Ứng dụng Trí tuệ Nhân tạo (AI Application)',
      description: 'Tích hợp AI/Gemini hiệu quả, sáng tạo, giải quyết bài toán thực tế.',
      weight: 30,
      maxScore: 10,
      order: 2
    }),
    new Criterion({
      rubricId: rubric._id,
      code: 'TEAM',
      name: 'Tương tác Git (Git Collaboration)',
      description: 'Tần suất commit đều đặn, phân phối việc tốt qua git history.',
      weight: 20,
      maxScore: 10,
      order: 3
    })
  ];

  for (const c of criteria) {
    await c.save();
  }
  console.log(`- Đã tạo Rubric & Criteria (${criteria.length} tiêu chí).`);

  // 5. Tạo các Tài khoản Thí sinh & Đội thi (Teams)
  console.log('\n[5/8] Tạo tài khoản Thí sinh & thành lập 3 Đội thi tương ứng với các bảng...');
  const teamNames = ['Đội Phoenix', 'Đội Alpha Tech', 'Đội Cyber Shield'];
  const createdTeams = [];

  for (let i = 0; i < teamNames.length; i++) {
    const leaderEmail = `leader-${i + 1}-${suffix}@example.com`;
    const memberEmail = `member-${i + 1}-${suffix}@example.com`;
    
    const leader = new User({
      email: leaderEmail,
      passwordHash,
      fullName: `Trưởng nhóm Đội ${i + 1} (${suffix})`,
      githubUsername: `github-leader-${i + 1}-${suffix}`,
      isApproved: true,
      isActive: true
    });
    await leader.save();

    const member = new User({
      email: memberEmail,
      passwordHash,
      fullName: `Thành viên Đội ${i + 1} (${suffix})`,
      githubUsername: `github-member-${i + 1}-${suffix}`,
      isApproved: true,
      isActive: true
    });
    await member.save();

    const track = tracks[i];
    const team = new Team({
      eventId: event._id,
      trackId: track._id,
      currentRoundId: round._id,
      leaderId: leader._id,
      name: `${teamNames[i]} (${suffix})`,
      status: 'confirmed'
    });
    await team.save();
    createdTeams.push(team);

    // Thành viên đội thi
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

    // EventRole cho participant
    const roleLeader = new EventRole({
      userId: leader._id,
      eventId: event._id,
      trackId: track._id,
      role: 'participant',
      status: 'active',
      assignedBy: admin._id
    });
    await roleLeader.save();

    const roleMember = new EventRole({
      userId: member._id,
      eventId: event._id,
      trackId: track._id,
      role: 'participant',
      status: 'active',
      assignedBy: admin._id
    });
    await roleMember.save();

    console.log(`- Thành lập Đội: "${team.name}" -> ${track.name} (Trưởng nhóm: ${leader.fullName})`);
  }

  // 6. Tạo GithubRepository & Mock Commits & CommitFiles & AI Analysis cho từng đội thi
  console.log('\n[6/8] Tạo Mock Git Repositories, Commits, Code Files và Đánh giá AI cho từng Đội...');
  const repoTemplates = [];
  for (let i = 0; i < createdTeams.length; i++) {
    const team = createdTeams[i];
    const track = tracks[i];

    // Tạo Repository
    const repoName = `repo-${team.name.replace(/\s+/g, '-').replace(/[()]/g, '').toLowerCase()}`;
    const repo = new GithubRepository({
      eventId: event._id,
      trackId: track._id,
      teamId: team._id,
      orgName: event.githubOrgName,
      repoName: repoName,
      repoUrl: `https://github.com/${event.githubOrgName}/${repoName}`,
      githubRepoId: `github-id-${team._id}`,
      defaultBranch: 'main',
      syncStatus: 'success',
      lastSyncedAt: new Date()
    });
    await repo.save();
    repoTemplates.push(repo);
    console.log(`  + Đội "${team.name}": Đã liên kết Repo "${repo.repoName}"`);

    // Tạo 3 Mock Commits khác nhau
    const commitTemplates = [
      {
        msg: 'feat: setup project environment and router initialization',
        filename: 'src/main.js',
        patch: '@@ -0,0 +1,15 @@\n+import React from "react";\n+import ReactDOM from "react-dom";\n+import App from "./App";\n+ReactDOM.render(<App />, document.getElementById("root"));',
        comments: 'Excellent initial project setup. The file organization follows modern standard conventions. Router is well integrated.',
        qScore: 8,
        aScore: 9
      },
      {
        msg: 'feat: build database schemas and connection middleware',
        filename: 'src/db/connection.js',
        patch: '@@ -0,0 +1,10 @@\n+const mongoose = require("mongoose");\n+module.exports = () => mongoose.connect(process.env.MONGO_URI);',
        comments: 'Good database connection architecture. Uses environment variables properly and handles asynchronous states correctly.',
        qScore: 9,
        aScore: 8
      },
      {
        msg: 'fix: resolve rendering performance bug and clean up hooks',
        filename: 'src/components/Dashboard.jsx',
        patch: '@@ -5,3 +5,9 @@\n-  useEffect(() => { fetchData() }, [data]);\n+  useEffect(() => { fetchData() }, []);',
        comments: 'Great bug resolution. Fixed the infinite re-rendering issue in useEffect by properly structuring dependency arrays.',
        qScore: 9,
        aScore: 10
      }
    ];

    for (let c = 0; c < commitTemplates.length; c++) {
      const template = commitTemplates[c];
      const commitSha = `sha-${suffix}-${c + 1}-${team._id.toString().slice(-4)}`;
      
      // Tạo Commit
      const commit = new Commit({
        repositoryId: repo._id,
        teamId: team._id,
        commitSha: commitSha,
        branch: 'main',
        authorGithubUsername: `mock-user-${i + 1}`,
        authorName: `Mock Dev ${i + 1}`,
        authorEmail: `mock-dev-${i + 1}@example.com`,
        message: template.msg,
        commitUrl: `${repo.repoUrl}/commit/${commitSha}`,
        additions: Math.floor(Math.random() * 40) + 10,
        deletions: Math.floor(Math.random() * 20) + 2,
        changedFilesCount: 1,
        committedAt: new Date(Date.now() - 3600000 * (6 - c * 2)), // Commits rải rác
        pulledAt: new Date(),
        diffFetched: true,
        diffSummary: `diff --git a/${template.filename} b/${template.filename}`
      });
      await commit.save();

      // Tạo CommitFile
      const commitFile = new CommitFile({
        commitId: commit._id,
        repositoryId: repo._id,
        filename: template.filename,
        status: 'modified',
        additions: commit.additions,
        deletions: commit.deletions,
        changes: commit.additions + commit.deletions,
        patch: template.patch
      });
      await commitFile.save();

      // Tạo AI Analysis cho commit này
      const aiAnalysis = new AiAnalysis({
        repositoryId: repo._id,
        teamId: team._id,
        roundId: round._id,
        commitId: commit._id,
        analysisType: 'commit_review',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        prompt: 'Analyze repository changes and score them.',
        status: 'completed',
        result: {
          qualitativeComments: template.comments,
          scores: {
            codeQuality: template.qScore,
            adherence: template.aScore
          },
          suggestedRefactoring: 'Keep code clean. Export reusable hooks to external modules.'
        },
        completedAt: new Date()
      });
      await aiAnalysis.save();
    }
    console.log(`  + Đội "${team.name}": Đã tạo thành công 3 Commits kèm Đánh giá AI tương ứng.`);
  }

  // 7. Tạo Điểm số từ Giám khảo
  console.log('\n[7/8] Khởi tạo Điểm số từ Giám khảo...');
  const mockScoreValues = [
    // Phoenix scores
    {
      judge1: { CODE: 8.5, AI: 9.0, TEAM: 8.0 },
      judge2: { CODE: 9.0, AI: 8.5, TEAM: 8.5 },
      comments1: 'Sản phẩm Web rất mượt mà, cấu trúc code rõ ràng. AI Gemini API tích hợp tự nhiên.',
      comments2: 'Tính năng chính hoạt động tốt, giao diện cyberpunk đẹp mắt. Tương tác Git đồng đều.'
    },
    // Alpha Tech scores
    {
      judge1: { CODE: 9.0, AI: 8.0, TEAM: 9.0 },
      judge2: { CODE: 8.5, AI: 9.0, TEAM: 8.0 },
      comments1: 'Mô hình AI huấn luyện tốt, độ chính xác cao. Git commits chất lượng và chuyên nghiệp.',
      comments2: 'Có sự đầu tư lớn vào dữ liệu và giải thuật. Tích hợp pipeline CI/CD cơ bản.'
    },
    // Cyber Shield scores
    {
      judge1: { CODE: 8.0, AI: 8.5, TEAM: 8.5 },
      judge2: { CODE: 8.5, AI: 8.0, TEAM: 9.0 },
      comments1: 'Thiết bị IoT kết nối ổn định, code firmware sạch sẽ. Thuyết trình tốt.',
      comments2: 'Khả năng bảo mật được chú trọng đúng mức. Các commit mô tả chi tiết, rõ ràng.'
    }
  ];

  const teamAverageScores = [];

  for (let i = 0; i < createdTeams.length; i++) {
    const team = createdTeams[i];
    const repo = repoTemplates[i];
    const scoreVal = mockScoreValues[i];

    const seedTeamScore = async (judge, criteriaMap, overallComment) => {
      let totalRawScore = 0;
      let totalWeightedScore = 0;
      const details = [];

      for (const criterion of criteria) {
        const val = criteriaMap[criterion.code];
        const wScore = val * (criterion.weight / rubric.totalWeight);
        totalRawScore += val;
        totalWeightedScore += wScore;

        details.push({
          criterionId: criterion._id,
          scoreValue: val,
          weightedScore: Math.round(wScore * 100) / 100,
          comment: `Điểm ${val}/10 cho tiêu chí ${criterion.name}`
        });
      }

      const score = new Score({
        teamId: team._id,
        repositoryId: repo._id,
        eventId: event._id,
        trackId: team.trackId,
        roundId: round._id,
        rubricId: rubric._id,
        judgeId: judge._id,
        totalRawScore: Math.round((totalRawScore / criteria.length) * 100) / 100,
        totalWeightedScore: Math.round(totalWeightedScore * 100) / 100,
        overallComment,
        status: 'submitted',
        submittedAt: new Date()
      });
      await score.save();

      for (const detail of details) {
        const scoreDetail = new ScoreDetail({
          scoreId: score._id,
          criterionId: detail.criterionId,
          scoreValue: detail.scoreValue,
          weightedScore: detail.weightedScore,
          comment: detail.comment
        });
        await scoreDetail.save();
      }

      return score.totalWeightedScore;
    };

    // Điểm từ Giám khảo 1
    const wScore1 = await seedTeamScore(judges[0], scoreVal.judge1, scoreVal.comments1);
    // Điểm từ Giám khảo 2
    const wScore2 = await seedTeamScore(judges[1], scoreVal.judge2, scoreVal.comments2);

    const averageWeightedScore = Math.round(((wScore1 + wScore2) / 2) * 100) / 100;
    teamAverageScores.push({
      teamId: team._id,
      trackId: team.trackId,
      averageScore: averageWeightedScore
    });

    console.log(`  + Đội "${team.name}": Điểm GK 1 = ${wScore1}, GK 2 = ${wScore2} (Trung bình: ${averageWeightedScore})`);
  }

  // 8. Tạo Bảng xếp hạng (Rankings)
  console.log('\n[8/8] Khởi tạo Bảng xếp hạng (Rankings) & Đóng điểm số...');
  teamAverageScores.sort((a, b) => b.averageScore - a.averageScore);

  const rankingsToSave = [];
  for (let idx = 0; idx < teamAverageScores.length; idx++) {
    const item = teamAverageScores[idx];
    const rank = idx + 1;
    const isAdvanced = rank <= round.advanceTopN;

    const ranking = new Ranking({
      eventId: event._id,
      trackId: item.trackId,
      roundId: round._id,
      teamId: item.teamId,
      averageScore: item.averageScore,
      finalScore: item.averageScore,
      judgeCount: 2,
      rank,
      isAdvanced,
      status: 'published',
      calculatedAt: new Date(),
      publishedAt: new Date()
    });
    rankingsToSave.push(ranking);

    // Khoá điểm số cho round này
    await Score.updateMany({ roundId: round._id, teamId: item.teamId }, { status: 'locked', lockedAt: new Date() });
  }
  await Ranking.insertMany(rankingsToSave);

  // Đánh dấu Round status là completed
  round.status = 'completed';
  await round.save();
  console.log('- Đã tạo Bảng xếp hạng và khóa tất cả điểm số thành công.');

  console.log('\n=== KHỞI TẠO THÀNH CÔNG TOÀN BỘ DỮ LIỆU CUỘC THI MOCK ===');
  console.log('----------------------------------------------------------------------');
  console.log(`Tên sự kiện: "${event.name}"`);
  console.log(`Trạng thái sự kiện: "${event.status.toUpperCase()}"`);
  console.log(`\nTài khoản đăng nhập được tạo (Mật khẩu mặc định: 123456):`);
  console.log(`1. Admin:`);
  console.log(`   - Email: ${admin.email}`);
  console.log(`2. Giám khảo (Judges):`);
  for (let j = 0; j < judges.length; j++) {
    console.log(`   - Email: ${judges[j].email}`);
  }
  console.log(`3. Cố vấn (Mentors):`);
  for (let m = 0; m < mentors.length; m++) {
    console.log(`   - Email: ${mentors[m].email}`);
  }
  console.log(`4. Thí sinh / Đội thi (Leaders & Members):`);
  for (let i = 0; i < createdTeams.length; i++) {
    const team = createdTeams[i];
    console.log(`   - Đội: "${team.name}"`);
    console.log(`     + Trưởng nhóm (Leader): leader-${i + 1}-${suffix}@example.com`);
    console.log(`     + Thành viên (Member): member-${i + 1}-${suffix}@example.com`);
  }
  console.log('----------------------------------------------------------------------');
  console.log('Bạn có thể chạy dự án và dùng các tài khoản trên đăng nhập để xem chi tiết lịch trình, commits, chấm điểm AI, điểm số giám khảo và bảng xếp hạng.');
  
  await mongoose.disconnect();
}

setupCompleteMockContest().catch(err => {
  console.error('Lỗi khi chạy script:', err);
  mongoose.disconnect();
});
