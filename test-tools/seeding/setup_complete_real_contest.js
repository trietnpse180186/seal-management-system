const path = require('path');
module.paths.push(path.join(__dirname, '../../server/node_modules'));
const mongoose = require('../../server/node_modules/mongoose');
const { Octokit } = require('@octokit/rest');
const readline = require('readline');
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });

// Register models
require('../../server/features/auth/User');
require('../../server/features/events/Event');
require('../../server/features/events/Track');
require('../../server/features/events/Round');
require('../../server/features/auth/EventRole');
require('../../server/features/teams/Team');
require('../../server/features/teams/TeamMember');
require('../../server/features/github-ai/GithubRepository');
require('../../server/features/github-ai/Commit');
require('../../server/features/github-ai/CommitFile');
require('../../server/features/github-ai/AiAnalysis');
require('../../server/features/grading/Rubric');
require('../../server/features/grading/Criterion');
require('../../server/features/grading/Score');
require('../../server/features/grading/ScoreDetail');
require('../../server/features/grading/Ranking');

const githubService = require('../../server/features/github-ai/githubService');
const cronService = require('../../server/features/events/cronService');

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans);
  }));
}

async function setupCompleteRealContest() {
  console.log('=== KHỞI TẠO CUỘC THI THỰC TẾ (TƯƠNG TÁC TỪNG BƯỚC) ===');

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

  const eventName = "Complete Test Event";
  const suffix = Date.now().toString().slice(-4);

  // 1. Dọn dẹp dữ liệu cũ hoàn toàn để bắt đầu sạch sẽ
  console.log('\n[1/7] Dọn dẹp sạch sẽ dữ liệu cuộc thi cũ...');
  const oldEvents = await Event.find({ name: eventName });
  for (const oldEvent of oldEvents) {
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
  await User.deleteMany({ email: { $regex: /com-test-.*@example\.com$/i } });
  console.log(`- Đã xóa sạch dữ liệu cũ liên quan đến "${eventName}".`);

  // 2. Tạo mới Event, Rounds, Rubrics, Tracks
  console.log('\n[2/7] Khởi tạo Event, Vòng thi và Bảng đấu...');
  const event = new Event({
    name: eventName,
    semester: "Fall",
    year: 2026,
    status: "registration",
    description: "Cuộc thi thực tế để bạn tự đăng ký và tham gia từ đầu đến cuối."
  });
  await event.save();
  console.log(`- Đã tạo Event: "${event.name}" (ID: ${event._id})`);

  const round1 = new Round({
    eventId: event._id,
    name: "Vòng sơ khảo",
    order: 1,
    status: "active",
    submissionDeadline: new Date(Date.now() + 3600000 * 24 * 7),
    advanceTopN: 1
  });
  await round1.save();

  const round2 = new Round({
    eventId: event._id,
    name: "Vòng chung kết",
    order: 2,
    status: "pending",
    submissionDeadline: new Date(Date.now() + 3600000 * 24 * 14),
    advanceTopN: 0
  });
  await round2.save();
  console.log(`- Đã tạo 2 Vòng thi.`);

  const rubric1 = new Rubric({
    name: "Rubric Vòng sơ khảo",
    eventId: event._id,
    roundId: round1._id,
    isActive: true,
    description: "Tiêu chí đánh giá mã nguồn dự án Vòng sơ khảo"
  });
  await rubric1.save();

  const criteriaData = [
    { code: "R1_01", name: "Problem & Solution Suitability", maxScore: 20, weight: 20, order: 1 },
    { code: "R1_02", name: "Data Pipeline & Integrity", maxScore: 20, weight: 20, order: 2 },
    { code: "R1_03", name: "Code Quality & Architecture", maxScore: 20, weight: 20, order: 3 },
    { code: "R1_04", name: "Security & Best Practices", maxScore: 20, weight: 20, order: 4 },
    { code: "R1_05", name: "Real-time Operations", maxScore: 20, weight: 20, order: 5 }
  ];
  const criteriaList1 = [];
  for (const c of criteriaData) {
    const criterion = new Criterion({
      rubricId: rubric1._id,
      code: c.code,
      name: c.name,
      maxScore: c.maxScore,
      weight: c.weight,
      order: c.order,
      description: `Đánh giá tiêu chí ${c.name}`
    });
    await criterion.save();
    criteriaList1.push(criterion);
  }

  const rubric2 = new Rubric({
    name: "Rubric Vòng chung kết",
    eventId: event._id,
    roundId: round2._id,
    isActive: true,
    description: "Tiêu chí đánh giá Vòng chung kết"
  });
  await rubric2.save();
  for (const c of criteriaData) {
    await new Criterion({
      rubricId: rubric2._id,
      code: c.code,
      name: c.name,
      maxScore: c.maxScore,
      weight: c.weight,
      order: c.order,
      description: `Đánh giá tiêu chí ${c.name} ở Vòng chung kết`
    }).save();
  }
  console.log(`- Đã tạo Rubrics và Tiêu chí chấm điểm.`);

  const trackFactory = new Track({
    eventId: event._id,
    roundId: round1._id,
    name: "FACTORY",
    environmentId: "6c10dc7a-4021-4299-a12b-215278a89c72",
    maxTeams: 10,
    advanceTopN: 1
  });
  await trackFactory.save();

  const trackFarm = new Track({
    eventId: event._id,
    roundId: round1._id,
    name: "FARM",
    environmentId: "4116b023-b085-4c72-8afa-6b82a00684f8",
    maxTeams: 10,
    advanceTopN: 1
  });
  await trackFarm.save();

  const trackHome = new Track({
    eventId: event._id,
    roundId: round1._id,
    name: "HOME",
    environmentId: "216e5417-b418-4c8f-bc03-13cf924fc7bd",
    maxTeams: 10,
    advanceTopN: 1
  });
  await trackHome.save();
  console.log(`- Đã tạo 3 Bảng đấu (FACTORY, FARM, HOME).`);

  const judgeEmail = `judge-com-test-${suffix}@example.com`;
  const judgeUser = new User({
    email: judgeEmail,
    fullName: `Giám Khảo Cuộc Thi (${suffix})`,
    passwordHash: '$2a$10$T8Z.G6B.c0n.gD.u0o.nG.hB.z7b8v9u10y11z12a13b14c15d16e',
    isApproved: true,
    isActive: true
  });
  await judgeUser.save();
  await new EventRole({ userId: judgeUser._id, eventId: event._id, role: 'judge', status: 'active' }).save();
  console.log(`- Đã tạo tài quan Giám khảo chấm thi: ${judgeEmail}`);

  // 3. TẠM DỪNG ĐỂ NGƯỜI DÙNG ĐĂNG KÝ ĐỘI
  console.log('\n======================================================');
  console.log(' [TẠM DỪNG] BƯỚC 3: HÃY ĐĂNG KÝ ĐỘI THI CỦA BẠN');
  console.log(` 1. Truy cập giao diện web của hệ thống.`);
  console.log(` 2. Đăng ký một tài khoản thành viên hoặc dùng tài khoản hiện tại.`);
  console.log(` 3. Tham gia/Tạo một đội thi thuộc sự kiện "Complete Test Event".`);
  console.log(` 4. Đảm bảo Đội thi của bạn đã được Admin Duyệt sang trạng thái "confirmed".`);
  console.log('======================================================');
  
  await askQuestion('Sau khi Đội thi của bạn đã ở trạng thái "confirmed" trên web, nhấn ENTER để tiếp tục...');

  // Cập nhật trạng thái cuộc thi sang "ongoing" để bắt đầu vận hành vòng thi
  event.status = "ongoing";
  await event.save();
  console.log(`- Đã cập nhật trạng thái sự kiện "${event.name}" sang "ongoing".`);

  // 4. Tìm kiếm đội thi của người dùng và sinh thêm đội ảo cho đủ
  console.log('\n[4/7] Quét danh sách đội thi và tự động nạp thêm đội ảo...');
  const existingTeams = await Team.find({ eventId: event._id });
  console.log(`- Tìm thấy ${existingTeams.length} đội thi do bạn đăng ký trên giao diện.`);

  // Phân loại đội người dùng theo bảng đấu
  const userTeamsByTrack = {
    [trackFactory._id.toString()]: [],
    [trackFarm._id.toString()]: [],
    [trackHome._id.toString()]: []
  };

  for (const t of existingTeams) {
    let modified = false;
    if (!t.trackId) {
      console.log(`- Đội "${t.name}" chưa chọn bảng đấu. Tự động gán vào bảng "FACTORY".`);
      t.trackId = trackFactory._id;
      modified = true;
    }
    if (!t.currentRoundId) {
      console.log(`- Đội "${t.name}" chưa gắn vòng đấu. Tự động gán vào Vòng 1 ("Vòng sơ khảo").`);
      t.currentRoundId = round1._id;
      modified = true;
    }
    if (t.status !== 'confirmed') {
      console.log(`- Đội "${t.name}" chưa xác nhận. Tự động duyệt sang "confirmed".`);
      t.status = 'confirmed';
      modified = true;
    }
    if (modified) {
      await t.save();
    }
    const trackIdStr = t.trackId.toString();
    if (userTeamsByTrack[trackIdStr]) {
      userTeamsByTrack[trackIdStr].push(t);
    }
  }

  const tracksConfig = [
    { track: trackFactory, namePrefix: 'factory', userTeams: userTeamsByTrack[trackFactory._id.toString()] },
    { track: trackFarm, namePrefix: 'farm', userTeams: userTeamsByTrack[trackFarm._id.toString()] },
    { track: trackHome, namePrefix: 'home', userTeams: userTeamsByTrack[trackHome._id.toString()] }
  ];

  const createdTeams = [];
  let userCount = 1;

  for (const tc of tracksConfig) {
    const userTeamsCount = tc.userTeams.length;
    console.log(`- Bảng ${tc.track.name} có ${userTeamsCount} đội người dùng.`);
    
    // Thêm các đội người dùng vào danh sách xử lý tiếp theo
    tc.userTeams.forEach((ut, idx) => {
      createdTeams.push({ team: ut, namePrefix: tc.namePrefix, index: `user-${idx + 1}`, isUserTeam: true, track: tc.track });
    });

    // Sinh thêm đội ảo để mỗi bảng có đúng 2 đội
    const mockNeeded = 2 - userTeamsCount;
    for (let m = 1; m <= mockNeeded; m++) {
      const email = `leader-com-test-${tc.namePrefix}-mock${m}-${suffix}@example.com`;
      const user = new User({
        email,
        fullName: `Leader Mock ${tc.track.name} Team ${m}`,
        passwordHash: '$2a$10$T8Z.G6B.c0n.gD.u0o.nG.hB.z7b8v9u10y11z12a13b14c15d16e',
        isApproved: true,
        isActive: true,
        studentId: `SE${180000 + userCount}`,
        university: 'FPT University'
      });
      await user.save();
      userCount++;

      const team = new Team({
        eventId: event._id,
        leaderId: user._id,
        name: `Team Mock ${m} - ${tc.track.name}`,
        status: 'confirmed',
        trackId: tc.track._id,
        currentRoundId: round1._id
      });
      await team.save();

      await new TeamMember({
        teamId: team._id,
        eventId: event._id,
        userId: user._id,
        role: 'leader',
        confirmStatus: 'confirmed',
        confirmedAt: new Date()
      }).save();

      await new EventRole({
        userId: user._id,
        eventId: event._id,
        role: 'participant',
        status: 'active'
      }).save();

      createdTeams.push({ team, namePrefix: tc.namePrefix, index: `mock-${m}`, isUserTeam: false, track: tc.track });
      console.log(`  + Đã nạp thêm đội ảo: "${team.name}" (Leader: ${email})`);
    }
  }

  // 5. Khởi tạo Repository và đẩy code mẫu
  console.log('\n[5/7] Khởi tạo Repository GitHub & Đẩy code mẫu...');
  const orgName = process.env.GITHUB_ORGANIZATION || 'sealhackathon-2026';
  const octokit = new Octokit({ auth: process.env.GITHUB_PERSONAL_ACCESS_TOKEN });
  const activeRepos = [];

  const codebases = {
    // Code mẫu nâng cao
    clean: {
      'package.json': JSON.stringify({ name: 'clean-rag-service', version: '1.0.0', dependencies: { '@google/genai': '^0.1.1', express: '^4.18.2' } }, null, 2),
      'app.js': `const express = require('express');\nconst { GoogleGenAI } = require('@google/genai');\nconst app = express();\napp.use(express.json());\nconst ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });\napp.post('/api/chat', async (req, res) => {\n  const { prompt } = req.body;\n  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });\n  try {\n    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });\n    res.json({ reply: response.text });\n  } catch (err) {\n    res.status(500).json({ error: 'Failed' });\n  }\n});\napp.listen(3000);`,
      'README.md': `# Clean RAG Service\nCấu trúc tối ưu và sạch sẽ.\n`
    },
    // Code lỗi bảo mật
    vulnerable: {
      'package.json': JSON.stringify({ name: 'vulnerable-service', version: '1.0.0', dependencies: { express: '^4.18.2' } }, null, 2),
      'app.js': `const express = require('express');\nconst app = express();\napp.use(express.json());\nconst MONGO_PASSWORD = "super-secret-password-123456";\nconst GEMINI_KEY = "AIzaSyFakeMockKeyForTestingVulnerability123";\napp.post('/api/chat', (req, res) => {\n  res.send("Vulnerable site");\n});\napp.listen(3000);`,
      'README.md': `# Vulnerable Service\nBị lỗi lộ API key giả định.\n`
    },
    // Code cơ bản
    basic: {
      'package.json': JSON.stringify({ name: 'basic-service', version: '1.0.0', dependencies: { express: '^4.18.2' } }, null, 2),
      'app.js': `const express = require('express');\nconst app = express();\napp.use(express.json());\napp.post('/api/chat', (req, res) => { res.send("Basic"); });\napp.listen(3000);`,
      'README.md': `# Basic Service\nCấu trúc cơ bản chưa tối ưu.\n`
    }
  };

  async function pushFile(owner, repo, filename, content, message) {
    try {
      let sha = undefined;
      try {
        const { data } = await octokit.repos.getContent({ owner, repo, path: filename });
        sha = data.sha;
      } catch (e) {}

      await octokit.repos.createOrUpdateFileContents({
        owner, repo, path: filename, message,
        content: Buffer.from(content).toString('base64'),
        sha, branch: 'main'
      });
    } catch (err) {
      console.error(`  - Lỗi khi đẩy tệp ${filename}:`, err.message);
    }
  }

  for (const item of createdTeams) {
    // Kiểm tra xem đội đã có repository trong DB chưa
    let repoRecord = await GithubRepository.findOne({ teamId: item.team._id });
    
    if (repoRecord) {
      console.log(`- Đội "${item.team.name}" đã cấu hình Repository: ${repoRecord.repoUrl}`);
      activeRepos.push({ repoRecord, item });
      continue;
    }

    if (item.isUserTeam) {
      // Đội của người dùng chưa có Repo
      console.log(`\n- Phát hiện đội của bạn "${item.team.name}" chưa được cấu hình Repository.`);
      const choice = await askQuestion(`Bạn muốn: \n (1) Tự liên kết Repo thủ công trên giao diện Web \n (2) Để script tự động khởi tạo Repo thật trên GitHub và đẩy code mẫu Clean RAG \nNhập lựa chọn của bạn (1 hoặc 2, mặc định là 2): `);
      
      if (choice.trim() === '1') {
        console.log('Vui lòng vào giao diện web, liên kết Repository cho đội của bạn.');
        await askQuestion('Sau khi đã liên kết xong Repo trên web, hãy nhấn ENTER để tiếp tục...');
        repoRecord = await GithubRepository.findOne({ teamId: item.team._id });
        if (!repoRecord) {
          console.log('Không tìm thấy Repo liên kết. Chuyển sang chế độ tự động tạo.');
        }
      }
    }

    // Tự động tạo repo và đẩy code mẫu
    if (!repoRecord) {
      const repoName = `com-test-${item.namePrefix}-t-${item.index}-${suffix}`;
      console.log(`- Đang tạo GitHub repo thực tế "${repoName}"...`);
      try {
        const repoResult = await githubService.createTeamRepository(repoName, 'public', orgName);
        repoRecord = new GithubRepository({
          teamId: item.team._id,
          eventId: event._id,
          repoName: repoName,
          repoUrl: repoResult.repoUrl,
          githubRepoId: repoResult.githubRepoId,
          orgName: repoResult.owner
        });
        await repoRecord.save();
        console.log(`  + Đã tạo repo thành công: ${repoRecord.repoUrl}`);

        // Đẩy code mẫu tương ứng (Đội 1/User: Clean, Đội 2: Vulnerable, Đội 3: Basic)
        let codebaseType = 'clean';
        if (item.index === 'mock-2') codebaseType = 'vulnerable';
        if (item.index === 'mock-3') codebaseType = 'basic';

        const files = codebases[codebaseType];
        console.log(`  + Đẩy code mẫu dạng [${codebaseType}]...`);
        for (const [filename, content] of Object.entries(files)) {
          await pushFile(repoRecord.orgName, repoRecord.repoName, filename, content, `feat: Add project initial files`);
        }
      } catch (err) {
        console.error(`  - Thao tác GitHub repo thất bại:`, err.message);
      }
    }

    if (repoRecord) {
      activeRepos.push({ repoRecord, item });
    }
  }

  // 6. ĐỒNG BỘ VÀ CHẠY n8n PHÂN TÍCH
  console.log('\n======================================================');
  console.log(' [TẠM DỪNG] BƯỚC 6: CHUẨN BỊ ĐỒNG BỘ CODE & CHẠY n8n AI REVIEW');
  console.log(' Nhấn ENTER để bắt đầu quét các repository và kích hoạt AI review...');
  console.log('======================================================');
  await askQuestion('');

  for (const ar of activeRepos) {
    console.log(`- Đang đồng bộ và kích hoạt n8n AI review cho: "${ar.repoRecord.repoName}"...`);
    try {
      await cronService.syncRepo(ar.repoRecord._id);
      console.log(`  + Đồng bộ hoàn tất.`);
    } catch (syncErr) {
      console.error(`  - Lỗi khi đồng bộ:`, syncErr.message);
    }
    console.log('Chờ 15 giây tránh rate limit...');
    await new Promise(resolve => setTimeout(resolve, 15000));
  }

  // 7. GIẢ LẬP CHẤM ĐIỂM GIÁM KHẢO
  console.log('\n======================================================');
  console.log(' [TẠM DỪNG] BƯỚC 7: XEM KẾT QUẢ AI & TIẾN HÀNH CHẤM ĐIỂM GIÁM KHẢO');
  console.log(' 1. Bạn hãy vào giao diện Admin để xem kết quả phân tích AI.');
  console.log(' 2. Chuẩn bị nhập điểm số chấm thi cho đội của bạn.');
  console.log('======================================================');
  
  const userScoreStr = await askQuestion('Nhập điểm trung bình bạn muốn chấm cho đội của mình (Từ 0.0 đến 10.0, ví dụ: 9.5): ');
  const userScore = parseFloat(userScoreStr) || 9.6;

  console.log(`\n- Tiến hành giả lập chấm điểm giám khảo (Đội bạn: ${userScore.toFixed(2)}đ)...`);

  const mockScores = {
    'mock-1': [9.2, 9.0, 9.2, 9.0, 9.0], // Đội mock 1 (Sạch): ~9.1
    'mock-2': [4.0, 3.5, 4.0, 3.0, 3.5], // Đội mock 2 (Lỗi bảo mật): ~3.6
    'mock-3': [6.5, 6.0, 7.0, 6.0, 6.5]  // Đội mock 3 (Cơ bản): ~6.4
  };

  const scoresList = [];

  for (const ar of activeRepos) {
    const team = ar.item.team;
    const repoRecord = ar.repoRecord;
    const isUser = ar.item.isUserTeam;
    const idx = ar.item.index;

    let scoresValues = mockScores[idx];
    if (isUser) {
      // Chấm đều điểm cho đội người dùng để đạt tổng weighted score = userScore
      scoresValues = [userScore, userScore, userScore, userScore, userScore];
    }

    if (!scoresValues) {
      scoresValues = [8.0, 8.0, 8.0, 8.0, 8.0]; // fallback
    }

    let totalRaw = 0;
    scoresValues.forEach(val => totalRaw += val);
    const avgScore = totalRaw / 5;
    const weightedScore = avgScore;

    const score = new Score({
      teamId: team._id,
      repositoryId: repoRecord._id,
      eventId: event._id,
      trackId: team.trackId,
      roundId: round1._id,
      rubricId: rubric1._id,
      judgeId: judgeUser._id,
      totalRawScore: totalRaw,
      totalWeightedScore: weightedScore,
      overallComment: `Đánh giá dự án đội ${team.name} bởi giám khảo.`,
      status: 'locked',
      submittedAt: new Date(),
      lockedAt: new Date()
    });
    await score.save();
    scoresList.push(score);

    for (let cIdx = 0; cIdx < criteriaList1.length; cIdx++) {
      const criterion = criteriaList1[cIdx];
      await new ScoreDetail({
        scoreId: score._id,
        criterionId: criterion._id,
        scoreValue: scoresValues[cIdx],
        weightedScore: scoresValues[cIdx] * (criterion.weight / 100),
        comment: `Đạt ${scoresValues[cIdx]}/${criterion.maxScore}đ tiêu chí ${criterion.name}`
      }).save();
    }
    console.log(`  + Đã chấm điểm cho đội "${team.name}": ${weightedScore.toFixed(2)} điểm.`);
  }

  // Tính xếp hạng các bảng đấu
  console.log('- Tính toán xếp hạng bảng đấu và thăng hạng...');
  const activeTracks = [trackFactory, trackFarm, trackHome];
  const rankingsToSave = [];

  for (const track of activeTracks) {
    const trackTeams = createdTeams.filter(t => t.track._id.toString() === track._id.toString());
    const trackStandings = [];

    for (const tItem of trackTeams) {
      const scoreRecord = scoresList.find(s => s.teamId.toString() === tItem.team._id.toString());
      trackStandings.push({
        teamId: tItem.team._id,
        score: scoreRecord ? scoreRecord.totalWeightedScore : 0
      });
    }

    trackStandings.sort((a, b) => b.score - a.score);

    trackStandings.forEach((item, idx) => {
      const rank = idx + 1;
      const isAdvanced = rank <= track.advanceTopN;

      const rankingRecord = new Ranking({
        eventId: event._id,
        roundId: round1._id,
        trackId: track._id,
        teamId: item.teamId,
        averageScore: item.score,
        trackRank: rank,
        globalRank: rank,
        isAdvanced
      });
      rankingsToSave.push(rankingRecord);
      console.log(`    * Bảng ${track.name}: Hạng ${rank} -> Team ID ${item.teamId} (${item.score.toFixed(2)}đ, Advanced: ${isAdvanced})`);
    });
  }

  await Ranking.insertMany(rankingsToSave);

  // Thăng hạng
  const advancedRankings = rankingsToSave.filter(r => r.isAdvanced === true);
  const advancedTeamIds = advancedRankings.map(r => r.teamId);

  if (advancedTeamIds.length > 0) {
    let finalTrack = await Track.findOne({ roundId: round2._id, name: "Bảng Chung Kết" });
    if (finalTrack) {
      console.log(`  + Đang sử dụng bảng đấu chung kết cũ: "${finalTrack.name}"`);
    } else {
      finalTrack = new Track({
        eventId: event._id,
        roundId: round2._id,
        name: "Bảng Chung Kết",
        maxTeams: 10,
        description: "Bảng đấu chung kết xếp hạng toàn diện"
      });
      await finalTrack.save();
      console.log(`  + Đã tạo bảng đấu mới: "${finalTrack.name}" dưới Vòng chung kết (Round 2).`);
    }

    await Team.updateMany(
      { _id: { $in: advancedTeamIds } },
      {
        $set: {
          currentRoundId: round2._id,
          trackId: finalTrack._id
        }
      }
    );
    console.log(`  + Đã cập nhật các đội thăng hạng lên Vòng chung kết.`);
  }

  round1.status = "completed";
  await round1.save();
  
  round2.status = "active";
  await round2.save();

  console.log(`  + Đã đóng Vòng 1 và kích hoạt Vòng 2.`);
  console.log('\n=== ĐÃ HOÀN THÀNH TOÀN BỘ LUỒNG TƯƠNG TÁC THÀNH CÔNG RỰC RỠ ===');
  await mongoose.disconnect();
}

setupCompleteRealContest().catch(err => {
  console.error('Lỗi khi chạy script setup:', err);
  mongoose.disconnect();
});
