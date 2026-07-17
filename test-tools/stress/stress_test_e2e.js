const mongoose = require('../../server/node_modules/mongoose');
const { Octokit } = require('@octokit/rest');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';
const githubToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
const orgName = process.env.GITHUB_ORGANIZATION || 'sealhackathon-2026';

if (!githubToken) {
  console.error('[ERROR] GITHUB_PERSONAL_ACCESS_TOKEN is not defined in server/.env');
  process.exit(1);
}

const octokit = new Octokit({ auth: githubToken });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Concurrency helper
async function asyncPool(concurrency, iterable, iteratorFn) {
  const ret = [];
  const executing = new Set();
  for (const item of iterable) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  return Promise.all(ret);
}

// Register models from backend to reuse schemas
console.log('[DEBUG] Registering backend Mongoose models...');
require('../../server/features/events/Event');
require('../../server/features/events/Round');
require('../../server/features/events/Track');
require('../../server/features/events/Prize');
require('../../server/features/teams/Team');
require('../../server/features/teams/TeamMember');
require('../../server/features/auth/User');
require('../../server/features/auth/EventRole');
require('../../server/features/github-ai/GithubRepository');
require('../../server/features/github-ai/Commit');
require('../../server/features/github-ai/CommitFile');
require('../../server/features/github-ai/AiAnalysis');
require('../../server/features/grading/Rubric');
require('../../server/features/grading/Criterion');
require('../../server/features/notifications/Notification');

const Event = mongoose.model('Event');
const Track = mongoose.model('Track');
const Round = mongoose.model('Round');
const Rubric = mongoose.model('Rubric');
const Criterion = mongoose.model('Criterion');
const User = mongoose.model('User');
const EventRole = mongoose.model('EventRole');
const Team = mongoose.model('Team');
const GithubRepository = mongoose.model('GithubRepository');
const Commit = mongoose.model('Commit');
const CommitFile = mongoose.model('CommitFile');
const AiAnalysis = mongoose.model('AiAnalysis');

// Define templates for 2 code pushes (Commit 1 and Commit 2)
// Commit 1: Scaffolding files (simple setup)
const commit1Templates = {
  'README.md': '# Project Scaffolding\nDefault workspace setup.',
  'src/index.js': 'console.log("System initialized...");'
};

// Commit 2 Templates per scenario
const commit2Templates = {
  // --- TRACK 1: SMART HOME ---
  t1_passed: {
    'docs/kien_truc.md': `# Kiến trúc model AI
- Sử dụng mô hình **Gemini 2.5 Flash** làm AI Agent cốt lõi.
- Tích hợp RAG để truy xuất thông tin hướng dẫn và ma trận xử lý sự cố.`,
    'src/aiAgent.js': `const { GoogleGenAI } = require('@google/generative-ai');
// ML/DL model analysis evidence
async function evaluateHomeSafety(sensorData) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  // Parse 5 devices
  const devices = ['AC_01', 'SENSOR_01', 'METER_01', 'CO2_01', 'HEATER_01'];
  console.log("Analyzing telemetry for devices:", devices.join(', '));
  
  let severity = "LOW";
  if (sensorData.co2 > 1200) {
    severity = "CRITICAL"; // Gán nhãn severity chuẩn xác khớp ma trận BTC
  }
  
  const prompt = \`Hãy đưa ra cảnh báo an toàn cho Chủ hộ bằng tiếng Việt. Cần cụ thể và dễ hiểu.\`;
  const result = await model.generateContent(prompt);
  return { severity, warningMessage: result.response.text };
}`
  },
  t1_failed_ai: {
    'src/alertService.js': `// Chỉ dùng logic if/else tĩnh không có giải thuật AI
function processTelemetry(data) {
  // AC_01, SENSOR_01, METER_01, CO2_01, HEATER_01, LIGHT_01
  if (data.co2 > 1000) {
    console.log("Cảnh báo khí CO2 cao!");
  } else if (data.temperature > 40) {
    console.log("Nhiệt độ phòng khách quá cao!");
  }
}`
  },
  t1_failed_severity: {
    'docs/kien_truc.md': `# Sơ đồ model AI\nSử dụng Gemini API để gán nhãn sự cố.`,
    'src/aiAgent.js': `const { GoogleGenAI } = require('@google/generative-ai');
// Vi phạm Severity: Gán nhãn sai lệch ma trận của BTC quá 1 bậc
async function evaluateHomeSafety(sensorData) {
  let severity = "LOW"; // Sai lệch: rò rỉ khí gas CO2 > 1200 vẫn báo LOW (BTC yêu cầu Critical)
  if (sensorData.co2 > 1200) {
    severity = "LOW"; 
  }
  return { severity, warningMessage: "Không sao đâu, mọi thứ bình thường!" };
}`
  },
  t1_failed_devices: {
    'docs/kien_truc.md': `# Thiết kế AI\nSử dụng AI model để giám sát.`,
    'src/aiAgent.js': `// Vi phạm: Chỉ hiển thị/parse 2/6 thiết bị (AC_01 và SENSOR_01)
function checkTelemetry(data) {
  const activeDevices = ['AC_01', 'SENSOR_01']; // Bỏ qua 4 thiết bị còn lại
  console.log("Chỉ hiển thị:", activeDevices);
}`
  },

  // --- TRACK 2: SMART AGRICULTURE ---
  t2_passed: {
    'docs/model_description.md': `# Giải thuật AI xử lý chuỗi thời gian
- Sử dụng Time-window (cửa sổ thời gian) gồm 15 data points gần nhất.
- Phân tích xu hướng độ ẩm đất để đưa ra quyết định tưới tiêu tối ưu.`,
    'src/timeWindowProcessor.js': `// Bằng chứng xử lý Time-window (Time-series data)
const dataBuffer = [];
function processSoilMoisture(newRecord) {
  dataBuffer.push(newRecord);
  if (dataBuffer.length > 15) dataBuffer.shift();
  
  // Tính trung bình trượt (Moving Average)
  const sum = dataBuffer.reduce((acc, r) => acc + r.soil_moisture, 0);
  const avgMoisture = sum / dataBuffer.length;
  
  // Parse 5 thiết bị: SOIL_01, WEATHER_01, PUMP_01, TANK_01, SUN_01
  return avgMoisture < 35 ? "TRIGGER_PUMP" : "STANDBY";
}`,
    'src/App.jsx': `// Giao diện Responsive dùng Tailwind
export default function App() {
  return (
    <div className="w-full min-h-screen bg-emerald-950 p-4 md:p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="p-4 bg-emerald-900 rounded-lg shadow-lg">Biểu đồ SOIL_01</div>
      </div>
    </div>
  );
}`
  },
  t2_failed_ai: {
    'src/pumpController.js': `// Vi phạm: So sánh trực tiếp giá trị cuối cùng, không xử lý chuỗi thời gian
function evaluatePump(currentPayload) {
  if (currentPayload.soil_moisture < 30) {
    return "TURN_ON";
  }
  return "TURN_OFF";
}`
  },
  t2_failed_mobile: {
    'docs/kien_truc.md': `# AI Time Window\nSử dụng mảng dữ liệu lịch sử.`,
    'src/timeWindowProcessor.js': `const buffer = [];`,
    'src/App.css': `/* Vi phạm Mobile-friendly: Thiết lập kích thước cứng gây vỡ layout */
.dashboard-container {
  width: 1500px;
  min-width: 1500px;
  overflow: hidden;
  display: block;
}`
  },

  // --- TRACK 3: SMART FACTORY ---
  t3_passed: {
    'docs/predictive_model.md': `# Thuật toán Predictive Maintenance
- Dự báo lỗi động cơ MOTOR_01 trước khi nhiệt độ vượt ngưỡng max_threshold.
- Phân tích gradient nhiệt độ kết hợp tần số rung động.`,
    'src/predictiveRunner.js': `// Thuật toán Predictive: Dự báo lỗi trước khi xảy ra
const tempHistory = [];
function checkPredictiveAlert(newTemp, vibration) {
  tempHistory.push(newTemp);
  if (tempHistory.length > 5) tempHistory.shift();
  
  // Tính tốc độ tăng nhiệt độ (Gradient)
  if (tempHistory.length >= 2) {
    const rateOfChange = tempHistory[tempHistory.length - 1] - tempHistory[0];
    if (rateOfChange > 5 && newTemp > 70) {
      return "PREDICTIVE_WARNING_MOTOR_01"; // Cảnh báo sớm trước khi chạm ngưỡng 80
    }
  }
  return "OK";
}`,
    'src/alertManager.js': `// Lọc nhiễu (Debouncing)
let alertTimeout;
function triggerDebouncedAlert(message) {
  clearTimeout(alertTimeout);
  alertTimeout = setTimeout(() => {
    console.log("Cảnh báo đã lọc nhiễu:", message);
  }, 1500); // Tránh spam nhấp nháy giao diện
}`
  },
  t3_failed_ai: {
    'src/safetySwitch.js': `// Vi phạm: Thuật toán thụ động phát hiện lỗi khi đã vượt ngưỡng
function checkSafety(motorData) {
  if (motorData.temperature > 80) { // Đã vượt quá ngưỡng an toàn
    return "SHUTDOWN_CONVEYOR_01";
  }
  return "NORMAL";
}`
  },
  t3_failed_debounce: {
    'docs/predictive_model.md': `# Thuật toán Predictive\nDự báo nhiệt độ tăng dần.`,
    'src/predictiveRunner.js': `const tempHistory = [];`,
    'src/alertSpammer.js': `// Vi phạm: Không lọc nhiễu, spam cảnh báo liên tục
function onMessageReceived(payload) {
  // Cứ nhận bản ghi nhiễu là phát cảnh báo lập tức gây nhấp nháy giao diện
  triggerImmediateAlert("Cảnh báo thiết bị: " + payload.deviceCode);
}`
  }
};

const numTeams = 30;

async function main() {
  const args = process.argv.slice(2);
  let mode = 'concurrency'; 
  let limit = 5; // Giới hạn chạy song song AI (cooldown để tránh rate limit Gemini)

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode') mode = args[i + 1];
    else if (args[i] === '--limit') limit = parseInt(args[i + 1], 10);
  }

  console.log('====================================================');
  console.log(`[E2E STRESS TEST] STARTING`);
  console.log(`[E2E STRESS TEST] Teams: ${numTeams}`);
  console.log(`[E2E STRESS TEST] Mode: ${mode.toUpperCase()} (Limit: ${limit})`);
  console.log('====================================================');

  console.log('[E2E] Connecting to database...');
  await mongoose.connect(mongoUri);
  console.log('[E2E] Connected successfully.');

  // ==========================================
  // BƯỚC 1: Khởi tạo DB (Event, Tracks, Rubric, Criteria)
  // ==========================================
  console.log('\n[STEP 1] Initializing Database States...');
  
  // Cleanup old stress test
  const oldEvent = await Event.findOne({ semester: 'Summer', year: 2026 });
  if (oldEvent) {
    console.log('[CLEANUP] Cleaning old stress test database records...');
    const eventId = oldEvent._id;
    const rounds = await Round.find({ eventId });
    for (const r of rounds) {
      const rubrics = await Rubric.find({ roundId: r._id });
      for (const rub of rubrics) {
        await Criterion.deleteMany({ rubricId: rub._id });
      }
      await Rubric.deleteMany({ roundId: r._id });
    }
    await Event.deleteOne({ _id: eventId });
    await Track.deleteMany({ eventId });
    await Round.deleteMany({ eventId });
    await Team.deleteMany({ eventId });
    await EventRole.deleteMany({ eventId });
    
    // Cleanup commits and analyses
    const repos = await GithubRepository.find({ eventId });
    const repoIds = repos.map(r => r._id);
    await Commit.deleteMany({ repositoryId: { $in: repoIds } });
    await CommitFile.deleteMany({ repositoryId: { $in: repoIds } });
    await AiAnalysis.deleteMany({ repositoryId: { $in: repoIds } });
    await GithubRepository.deleteMany({ eventId });
    
    console.log('[CLEANUP] Database cleaned.');
  }

  // Create new event
  const event = new Event({
    name: 'Stress Test Hackathon 2026',
    semester: 'Summer',
    year: 2026,
    status: 'ongoing',
    registrationOpen: new Date(Date.now() - 3600000 * 48),
    registrationClose: new Date(Date.now() - 3600000 * 24),
    contestStart: new Date(Date.now() - 3600000 * 12),
    contestEnd: new Date(Date.now() + 3600000 * 12),
    githubOrgName: orgName
  });
  await event.save();

  const round = await new Round({ eventId: event._id, name: 'Vòng Loại', order: 1, status: 'active' }).save();

  // Create 3 Tracks matching SU25 đề thi
  const t1 = await new Track({ eventId: event._id, roundId: round._id, name: 'Track 1: Smart Home' }).save();
  const t2 = await new Track({ eventId: event._id, roundId: round._id, name: 'Track 2: Smart Agriculture' }).save();
  const t3 = await new Track({ eventId: event._id, roundId: round._id, name: 'Track 3: Smart Factory' }).save();
  const tracks = [t1, t2, t3];

  const rubric = await new Rubric({ eventId: event._id, roundId: round._id, name: 'Bảng điểm E2E', isActive: true }).save();

  const criteria = [
    { code: 'CODE', name: 'Chất lượng Mã nguồn', maxScore: 10, weight: 50, order: 1 },
    { code: 'AI', name: 'Giải pháp AI & Ràng buộc loại', maxScore: 10, weight: 50, order: 2 }
  ];
  for (const c of criteria) {
    await new Criterion({
      rubricId: rubric._id,
      code: c.code,
      name: c.name,
      maxScore: c.maxScore,
      weight: c.weight,
      order: c.order,
      gradingLevels: [
        { label: 'Xuất sắc', minScore: 9.0, maxScore: 10.0 },
        { label: 'Tốt', minScore: 8.0, maxScore: 8.9 },
        { label: 'Khá', minScore: 6.5, maxScore: 7.9 },
        { label: 'Trung bình', minScore: 5.0, maxScore: 6.4 },
        { label: 'Yếu', minScore: 0.0, maxScore: 4.9 }
      ]
    }).save();
  }

  // ==========================================
  // BƯỚC 2: Tạo 30 Đội thi & Đăng ký trên Database
  // ==========================================
  console.log('\n[STEP 2] Provisioning 30 Teams in Database...');
  const activeRepos = [];

  for (let i = 1; i <= numTeams; i++) {
    const teamNum = String(i).padStart(2, '0');
    const teamName = `Team Stress ${teamNum}`;
    const repoName = `team-stress-${teamNum}`;
    const email = `leader-stress-${teamNum}@example.com`;

    const track = tracks[(i - 1) % tracks.length];

    let user = await User.findOne({ email });
    if (!user) {
      user = await new User({
        email,
        fullName: `Leader Stress ${teamNum}`,
        githubUsername: `stress-user-${teamNum}`,
        passwordHash: '$2b$10$abcdefghijklmnopqrstuv'
      }).save();
    }

    await new EventRole({ userId: user._id, eventId: event._id, role: 'participant' }).save();
    const team = await new Team({
      eventId: event._id,
      trackId: track._id,
      currentRoundId: round._id,
      name: teamName,
      status: 'confirmed',
      leaderId: user._id
    }).save();

    const repoRecord = await new GithubRepository({
      eventId: event._id,
      trackId: track._id,
      teamId: team._id,
      orgName: orgName,
      repoName: repoName,
      repoUrl: `https://github.com/${orgName}/${repoName}`,
      githubRepoId: `stress-${Date.now()}-${i}`,
      syncStatus: 'not_synced',
      isArchived: false
    }).save();

    // Determine the scenario type for this team
    let scenario = 'passed';
    const index = (i - 1) % 6; // Xoay vòng 6 kịch bản
    if (index === 0) scenario = 'passed';
    else if (index === 1) scenario = 'failed_ai';
    else if (index === 2) scenario = 'failed_severity';
    else if (index === 3) scenario = 'failed_mobile';
    else if (index === 4) scenario = 'failed_debounce';
    else if (index === 5) scenario = 'failed_devices';

    activeRepos.push({
      record: repoRecord,
      teamName,
      trackIndex: (i - 1) % tracks.length, // 0: Track 1, 1: Track 2, 2: Track 3
      scenario
    });
  }
  console.log(`[E2E] Linked 30 Repositories to event in MongoDB.`);

  // ==========================================
  // BƯỚC 3: Đẩy Commit 1 (Khung Dự Án)
  // ==========================================
  console.log('\n[STEP 3] GitHub Simulation: Pushing Commit 1 (Scaffolding)...');
  
  const pushCommit1 = async (teamInfo) => {
    const { repoName } = teamInfo.record;
    console.log(`[GITHUB PUSH 1] Creating repo & pushing scaffold files to ${repoName}...`);
    try {
      // Check/Create Repo
      let repoExists = false;
      try {
        await octokit.repos.get({ owner: orgName, repo: repoName });
        repoExists = true;
      } catch (e) { /* Not found */ }

      if (!repoExists) {
        await octokit.repos.createInOrg({
          org: orgName,
          name: repoName,
          private: true,
          auto_init: true
        });
        await sleep(1500); // Chờ khởi tạo
      }

      // Push Commit 1 files
      for (const [filePath, content] of Object.entries(commit1Templates)) {
        let sha;
        try {
          const res = await octokit.repos.getContent({ owner: orgName, repo: repoName, path: filePath });
          sha = res.data.sha;
        } catch (e) { /* New file */ }

        await octokit.repos.createOrUpdateFileContents({
          owner: orgName,
          repo: repoName,
          path: filePath,
          message: 'feat: Initialize project scaffolding',
          content: Buffer.from(content).toString('base64'),
          sha
        });
        await sleep(300);
      }
      console.log(`[GITHUB PUSH 1] Finished ${repoName}`);
    } catch (err) {
      console.error(`[GITHUB PUSH 1 ERROR] Failed on ${repoName}:`, err.message);
    }
  };

  // Push Commit 1 song song có giới hạn (concurrency limit = 5) để tránh Rate Limit GitHub
  await asyncPool(5, activeRepos, pushCommit1);
  console.log('[E2E] Completed Push 1.');

  // ==========================================
  // BƯỚC 4: Đồng bộ và Chạy AI Review Lần 1 (Đồng loạt)
  // ==========================================
  console.log('\n[STEP 4] Syncing & Running AI Analysis Lần 1...');
  const { syncRepo } = require('../../server/features/events/cronService');

  const executeSync = async (teamInfo) => {
    const repoRecord = teamInfo.record;
    const syncStart = Date.now();
    try {
      console.log(`[AI SYNC 1] Syncing ${repoRecord.repoName}...`);
      await syncRepo(repoRecord._id);
      console.log(`[AI SYNC 1 SUCCESS] Finished ${repoRecord.repoName} in ${((Date.now() - syncStart) / 1000).toFixed(2)}s`);
    } catch (err) {
      console.error(`[AI SYNC 1 FAILED] ${repoRecord.repoName} failed:`, err.message);
    }
  };

  // Chạy AI Sync 1
  if (mode === 'sequential') {
    for (const teamInfo of activeRepos) {
      await executeSync(teamInfo);
      console.log('[E2E] Sequential cooldown: sleeping 12 seconds to prevent Gemini Rate Limit (429)...');
      await sleep(12000);
    }
  } else if (mode === 'parallel') {
    await Promise.all(activeRepos.map(executeSync));
  } else {
    // Concurrency limit - with cooldown to prevent bursts
    const executeSyncWithCooldown = async (teamInfo) => {
      await executeSync(teamInfo);
      await sleep(12000);
    };
    await asyncPool(limit, activeRepos, executeSyncWithCooldown);
  }
  console.log('[E2E] AI Analysis Lần 1 hoàn thành.');

  // ==========================================
  // BƯỚC 5: Đẩy Commit 2 (Mô phỏng Đạt/Lỗi Auto-Fail)
  // ==========================================
  console.log('\n[STEP 5] GitHub Simulation: Pushing Commit 2 (Scenarios & Critical Fails)...');

  const pushCommit2 = async (teamInfo) => {
    const { repoName } = teamInfo.record;
    const { trackIndex, scenario } = teamInfo;

    // Determine the template key based on track and scenario
    const trackPrefix = `t${trackIndex + 1}`; // t1, t2, t3
    
    // Fallback scenario logic if track/scenario combination doesn't exist
    let scenarioKey = `${trackPrefix}_${scenario}`;
    if (!commit2Templates[scenarioKey]) {
      // Ví dụ: Track 2 không có FAILED_SEVERITY, map sang FAILED_AI
      scenarioKey = `${trackPrefix}_failed_ai`;
    }

    const templates = commit2Templates[scenarioKey] || commit2Templates[`${trackPrefix}_passed`];
    console.log(`[GITHUB PUSH 2] Pushing scenario [${scenarioKey.toUpperCase()}] to ${repoName}...`);

    try {
      for (const [filePath, content] of Object.entries(templates)) {
        // Fetch current file to get SHA (for updating)
        let sha;
        try {
          const res = await octokit.repos.getContent({ owner: orgName, repo: repoName, path: filePath });
          sha = res.data.sha;
        } catch (e) { /* New file */ }

        await octokit.repos.createOrUpdateFileContents({
          owner: orgName,
          repo: repoName,
          path: filePath,
          message: `feat: Implement features for ${scenario}`,
          content: Buffer.from(content).toString('base64'),
          sha
        });
        await sleep(300);
      }
      console.log(`[GITHUB PUSH 2] Finished ${repoName}`);
    } catch (err) {
      console.error(`[GITHUB PUSH 2 ERROR] Failed on ${repoName}:`, err.message);
    }
  };

  // Push Commit 2 song song có giới hạn (concurrency limit = 5)
  await asyncPool(5, activeRepos, pushCommit2);
  console.log('[E2E] Completed Push 2.');

  // ==========================================
  // BƯỚC 6: Đồng bộ và Chạy AI Review Lần 2 (Đồng loạt)
  // ==========================================
  console.log('\n[STEP 6] Syncing & Running AI Analysis Lần 2 (Chấm điểm commit mới)...');

  const executeSync2 = async (teamInfo) => {
    const repoRecord = teamInfo.record;
    const syncStart = Date.now();
    try {
      console.log(`[AI SYNC 2] Syncing ${repoRecord.repoName}...`);
      // Lấy bản ghi mới nhất từ DB
      const freshRepo = await GithubRepository.findById(repoRecord._id);
      await syncRepo(freshRepo._id);
      console.log(`[AI SYNC 2 SUCCESS] Finished ${repoRecord.repoName} in ${((Date.now() - syncStart) / 1000).toFixed(2)}s`);
    } catch (err) {
      console.error(`[AI SYNC 2 FAILED] ${repoRecord.repoName} failed:`, err.message);
    }
  };

  // Chạy AI Sync 2
  if (mode === 'sequential') {
    for (const teamInfo of activeRepos) {
      await executeSync2(teamInfo);
      console.log('[E2E] Sequential cooldown: sleeping 12 seconds to prevent Gemini Rate Limit (429)...');
      await sleep(12000);
    }
  } else if (mode === 'parallel') {
    await Promise.all(activeRepos.map(executeSync2));
  } else {
    // Concurrency limit - with cooldown to prevent bursts
    const executeSync2WithCooldown = async (teamInfo) => {
      await executeSync2(teamInfo);
      await sleep(12000);
    };
    await asyncPool(limit, activeRepos, executeSync2WithCooldown);
  }
  console.log('[E2E] AI Analysis Lần 2 hoàn thành.');

  // ==========================================
  // BƯỚC 7: Xuất báo cáo kết quả đánh giá AI E2E
  // ==========================================
  console.log('\n====================================================');
  console.log(`[STEP 7] E2E EVALUATION REPORT: CRITICAL FAILS DETECTED BY AI`);
  console.log('====================================================');

  const report = [];
  for (const teamInfo of activeRepos) {
    const { repoName } = teamInfo.record;
    
    // Tìm các review AI mới nhất cho repo này
    const latestReview = await AiAnalysis.findOne({
      teamId: teamInfo.record.teamId,
      analysisType: 'commit_review',
      status: 'completed'
    }).sort({ createdAt: -1 });

    let aiOutput = 'N/A';
    let trackDetected = 'Unknown';
    let aiAlgCheck = 'N/A';
    let severityCheck = 'N/A';
    let uxCheck = 'N/A';
    let isDisqualified = 'N/A';
    let disqReason = '';

    if (latestReview && latestReview.result) {
      const output = latestReview.result;
      if (output.hard_constraints_validation) {
        const val = output.hard_constraints_validation;
        trackDetected = val.track_detected || 'Unknown';
        aiAlgCheck = val.ai_algorithm_check ? val.ai_algorithm_check.status : 'N/A';
        severityCheck = val.severity_accuracy_check ? val.severity_accuracy_check.status : 'N/A';
        uxCheck = val.ux_and_devices_check ? val.ux_and_devices_check.status : 'N/A';
        isDisqualified = val.is_disqualified ? 'YES (0đ)' : 'NO';
        disqReason = val.disqualification_reason || '';
      }
    }

    report.push({
      'Repository': repoName,
      'Scenario Expect': teamInfo.scenario.toUpperCase(),
      'Track Detected': trackDetected,
      'AI Alg Check': aiAlgCheck,
      'Severity Check': severityCheck,
      'UX/Devices Check': uxCheck,
      'Disqualified?': isDisqualified,
      'Reason': disqReason.substring(0, 50) + (disqReason.length > 50 ? '...' : '')
    });
  }

  console.table(report);
  console.log('\n====================================================');
  console.log(`[E2E COMPLETED SUCCESSFULLY]`);
  console.log('====================================================\n');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[FATAL E2E ERROR]:', err);
  mongoose.disconnect();
});
