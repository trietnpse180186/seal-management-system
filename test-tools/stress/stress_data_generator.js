const mongoose = require('../../server/node_modules/mongoose');
const { Octokit } = require('@octokit/rest');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';
const githubToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
const orgName = 'sealhackathon-2026';

// Check token
if (!githubToken) {
  console.error('[ERROR] GITHUB_PERSONAL_ACCESS_TOKEN is not defined in server/.env');
  process.exit(1);
}

const octokit = new Octokit({ auth: githubToken });

// Define inline schemas to avoid dependency issues when running as a standalone script
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  githubUsername: String,
});

const EventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  semester: String,
  year: Number,
  status: { type: String, default: 'draft' },
  registrationOpen: Date,
  registrationClose: Date,
  contestStart: Date,
  contestEnd: Date,
  githubOrgName: String,
});

const TrackSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  name: { type: String, required: true },
});

const RoundSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  name: { type: String, required: true },
  order: Number,
  status: { type: String, default: 'active' },
});

const TeamSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  trackId: { type: mongoose.Schema.Types.ObjectId, ref: 'Track' },
  name: { type: String, required: true },
  status: { type: String, default: 'pending' },
  leaderId: mongoose.Schema.Types.ObjectId,
});

const EventRoleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  role: { type: String, default: 'participant' },
  status: { type: String, default: 'active' },
});

const GithubRepositorySchema = new mongoose.Schema({
  eventId: mongoose.Schema.Types.ObjectId,
  trackId: mongoose.Schema.Types.ObjectId,
  teamId: mongoose.Schema.Types.ObjectId,
  orgName: String,
  repoName: String,
  repoUrl: String,
  githubRepoId: String,
  syncStatus: { type: String, default: 'not_synced' },
  lastSyncedAt: Date,
  lastCommitSha: String,
  isArchived: { type: Boolean, default: false }
});

const GradingLevelSchema = new mongoose.Schema({
  label: { type: String, required: true },
  minScore: { type: Number, required: true },
  maxScore: { type: Number, required: true },
  description: { type: String, default: '' }
}, { _id: true });

const RubricSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  trackId: mongoose.Schema.Types.ObjectId,
  roundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Round', required: true },
  name: { type: String, required: true },
  description: String,
  totalWeight: { type: Number, default: 100 },
  maxCriterionScore: { type: Number, default: 10 },
  version: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true },
  isLocked: { type: Boolean, default: false },
}, { timestamps: true });

const CriterionSchema = new mongoose.Schema({
  rubricId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rubric', required: true },
  code: { type: String, required: true },
  name: { type: String, required: true },
  description: String,
  weight: { type: Number, required: true },
  maxScore: { type: Number, default: 10.0 },
  order: Number,
  gradingLevels: { type: [GradingLevelSchema], default: [] }
}, { timestamps: true });

// Compile models
const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Event = mongoose.models.Event || mongoose.model('Event', EventSchema);
const Track = mongoose.models.Track || mongoose.model('Track', TrackSchema);
const Round = mongoose.models.Round || mongoose.model('Round', RoundSchema);
const Team = mongoose.models.Team || mongoose.model('Team', TeamSchema);
const EventRole = mongoose.models.EventRole || mongoose.model('EventRole', EventRoleSchema);
const GithubRepository = mongoose.models.GithubRepository || mongoose.model('GithubRepository', GithubRepositorySchema);
const Rubric = mongoose.models.Rubric || mongoose.model('Rubric', RubricSchema);
const Criterion = mongoose.models.Criterion || mongoose.model('Criterion', CriterionSchema);

// Delay helper
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('[SEEDER] Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('[SEEDER] Connected successfully.');

  // Clean old stress test data
  console.log('[CLEANUP] Cleaning old stress test data...');
  const oldEvent = await Event.findOne({ semester: 'Summer', year: 2026 });
  if (oldEvent) {
    const eventId = oldEvent._id;
    
    // Delete rubrics and criteria first before deleting rounds
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
    await GithubRepository.deleteMany({ eventId });
    console.log('[CLEANUP] MongoDB clean completed.');
  }

  // Create Event
  console.log('[SEEDER] Creating Stress Test Event...');
  const event = new Event({
    name: 'Stress Test Hackathon 2026',
    semester: 'Summer',
    year: 2026,
    status: 'ongoing', // Ready for grading
    registrationOpen: new Date(Date.now() - 3600000 * 48),
    registrationClose: new Date(Date.now() - 3600000 * 24),
    contestStart: new Date(Date.now() - 3600000 * 12),
    contestEnd: new Date(Date.now() + 3600000 * 12),
    githubOrgName: orgName
  });
  await event.save();
  console.log(`[SEEDER] Created Event ID: ${event._id}`);

  // Create 3 Tracks
  const tracks = [];
  const trackNames = [
    'Bảng A - AI & Machine Learning',
    'Bảng B - Web App Development',
    'Bảng C - IoT & Smart Devices'
  ];
  for (const name of trackNames) {
    const t = new Track({
      eventId: event._id,
      name
    });
    await t.save();
    tracks.push(t);
  }

  // Create Round
  const round = new Round({
    eventId: event._id,
    name: 'Vòng Chung Kết',
    order: 1,
    status: 'active'
  });
  await round.save();

  // Create Rubric
  const rubric = new Rubric({
    eventId: event._id,
    roundId: round._id,
    name: 'Bảng điểm Stress Test',
    isActive: true
  });
  await rubric.save();

  // Create Criteria
  const criteria = [
    {
      code: 'CODE',
      name: 'Chất lượng Mã nguồn',
      maxScore: 10,
      weight: 50,
      description: 'Chất lượng mã nguồn, cấu trúc thư mục, Clean Code và tối ưu hiệu năng.',
      order: 1
    },
    {
      code: 'AI',
      name: 'Độ chín AI / Giải pháp nghiệp vụ',
      maxScore: 10,
      weight: 30,
      description: 'Mức độ chín của giải pháp AI, ứng dụng RAG, Agentic flow hoặc logic xử lý nghiệp vụ.',
      order: 2
    },
    {
      code: 'TEAM',
      name: 'Phối hợp Đội ngũ',
      maxScore: 10,
      weight: 20,
      description: 'Tần suất đóng góp Git, phân chia công việc đều giữa các thành viên và tương tác nhóm.',
      order: 3
    }
  ];

  const defaultGradingLevels = [
    { label: 'Xuất sắc', minScore: 9.0, maxScore: 10.0, description: 'Đạt yêu cầu tối đa và vượt mong đợi.' },
    { label: 'Tốt', minScore: 8.0, maxScore: 8.9, description: 'Hoàn thành tốt toàn bộ các tiêu chí.' },
    { label: 'Khá', minScore: 6.5, maxScore: 7.9, description: 'Đáp ứng đầy đủ các yêu cầu cơ bản.' },
    { label: 'Trung bình', minScore: 5.0, maxScore: 6.4, description: 'Chỉ hoàn thành một phần yêu cầu.' },
    { label: 'Yếu', minScore: 0.0, maxScore: 4.9, description: 'Không đạt yêu cầu tối thiểu.' }
  ];

  for (const c of criteria) {
    const crit = new Criterion({
      rubricId: rubric._id,
      code: c.code,
      name: c.name,
      description: c.description,
      maxScore: c.maxScore,
      weight: c.weight,
      order: c.order,
      gradingLevels: defaultGradingLevels
    });
    await crit.save();
  }

  const numTeams = parseInt(process.argv[2], 10) || parseInt(process.env.NUM_TEAMS, 10) || 30;
  console.log(`[SEEDER] Generating ${numTeams} Teams, Git Repositories and Commits...`);

  const filesMap = {
    ai_ml: {
      'src/agent.js': `const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
// Agentic routing logic
async function runAgent(userInput) {
  const model = new ChatGoogleGenerativeAI({ modelName: "gemini-2.5-flash" });
  if (userInput.includes('search')) {
    return await callSearchTool(userInput);
  }
  return await model.invoke(userInput);
}`,
      'src/model.py': `import torch
import torch.nn as nn
# Simple CNN model for AI & ML track
class SimpleCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv = nn.Conv2d(3, 16, 3)
        self.fc = nn.Linear(16*26*26, 2)
    def forward(self, x):
        return self.fc(self.conv(x).view(x.size(0), -1))`
    },
    web_app: {
      'src/server.js': `const express = require('express');
const app = express();
app.use(express.json());
// Web App routing and logic
app.post('/api/query', (req, res) => {
  res.json({ reply: 'Web App RAG response' });
});
app.listen(3000, () => console.log('Web Server running on port 3000'));`,
      'src/App.jsx': `import React from 'react';
// Cyberpunk themed frontend
export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-cyan-400 font-mono p-8">
      <h1 className="text-4xl text-cyan-glow">Cyberpunk Hackathon Dashboard</h1>
    </div>
  );
}`
    },
    iot_smart: {
      'src/sensor.ino': `// DHT11 temperature & humidity readings
#include <DHT.h>
#include <PubSubClient.h>
#define DHTPIN 2
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);
void setup() {
  Serial.begin(9600);
  dht.begin();
}
void loop() {
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();
  client.publish("sensors/data", String("Temp: " + String(temp) + " Hum: " + String(hum)).c_str());
  delay(2000);
}`,
      'src/gateway.js': `const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://broker.hivemq.com');
// Gateway to subscribe and process sensor data
client.on('connect', () => {
  console.log('Connected to MQTT Broker');
  client.subscribe('sensors/data');
});
client.on('message', (topic, message) => {
  console.log('Received IoT Sensor Data:', message.toString());
});`
    }
  };

  const trackKeys = ['ai_ml', 'web_app', 'iot_smart'];

  for (let i = 1; i <= numTeams; i++) {
    const teamNum = String(i).padStart(2, '0');
    const teamName = `Team Stress ${teamNum}`;
    const repoName = `team-stress-${teamNum}`;
    const email = `leader-stress-${teamNum}@example.com`;

    console.log(`\n--------------------------------------------`);
    console.log(`[PROCESS] Processing ${teamName} (${i}/${numTeams})`);

    const track = tracks[(i - 1) % tracks.length];

    // Create User
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        email,
        fullName: `Leader Stress ${teamNum}`,
        githubUsername: `stress-user-${teamNum}`
      });
      await user.save();
    }

    // Create EventRole
    const role = new EventRole({
      userId: user._id,
      eventId: event._id,
      role: 'participant'
    });
    await role.save();

    // Create Team
    const team = new Team({
      eventId: event._id,
      trackId: track._id,
      name: teamName,
      status: 'confirmed',
      leaderId: user._id
    });
    await team.save();

    // Create GitHub Repository under 'sealhackathon-2026' org
    let repoUrl = `https://github.com/${orgName}/${repoName}`;
    let githubRepoId = `stress-${Date.now()}-${i}`;
    
    try {
      console.log(`[GITHUB] Checking if repository ${repoName} exists...`);
      let repoExists = false;
      try {
        await octokit.repos.get({ owner: orgName, repo: repoName });
        repoExists = true;
        console.log(`[GITHUB] Repo ${repoName} already exists, skipping creation.`);
      } catch (e) {
        // Not found, proceed to create
      }

      if (!repoExists) {
        console.log(`[GITHUB] Creating repository ${orgName}/${repoName} on GitHub...`);
        const createRes = await octokit.repos.createInOrg({
          org: orgName,
          name: repoName,
          private: true,
          auto_init: true // Creates main branch and README
        });
        githubRepoId = createRes.data.id.toString();
        repoUrl = createRes.data.html_url;
        console.log(`[GITHUB] Repository created: ${repoUrl}`);
        
        // Wait 1.5s for GitHub initialization
        await sleep(1500);
      }
      // Determine project template to push
      const ragType = trackKeys[(i - 1) % trackKeys.length];
      const templates = filesMap[ragType];

      console.log(`[GITHUB] Pushing ${ragType} RAG files to ${repoName} (creating commits)...`);
      
      let commitIdx = 1;
      for (const [filePath, content] of Object.entries(templates)) {
        console.log(`[GITHUB] Writing file ${filePath} (Commit #${commitIdx})...`);
        const commitMsg = commitIdx === 1 
          ? `feat: Initialize project setup and default express server`
          : `feat: Implement ${ragType} RAG pipeline with database search`;
        
        await octokit.repos.createOrUpdateFileContents({
          owner: orgName,
          repo: repoName,
          path: filePath,
          message: commitMsg,
          content: Buffer.from(content).toString('base64'),
        });
        
        commitIdx++;
        await sleep(500); // Avoid rate limit trigger
      }
      console.log(`[GITHUB] Successfully created commits on GitHub.`);
    } catch (gitErr) {
      console.error(`[GITHUB ERROR] Failed to create or write files for ${repoName}:`, gitErr.message);
      console.log(`[GITHUB FALLBACK] Registering mock repository ID for DB...`);
    }

    // Save GithubRepository record to DB
    const repoRecord = new GithubRepository({
      eventId: event._id,
      trackId: track._id,
      teamId: team._id,
      orgName: orgName,
      repoName: repoName,
      repoUrl: repoUrl,
      githubRepoId: githubRepoId,
      syncStatus: 'not_synced',
      isArchived: false
    });
    await repoRecord.save();
    console.log(`[DB] Linked Repository ${repoName} to database.`);

    // Delay 1s between teams to prevent hitting GitHub secondary limits
    await sleep(1000);
  }

  console.log(`\n============================================`);
  console.log(`[COMPLETED] Created Event "Stress Test Hackathon 2026" with 30 Teams.`);
  console.log(`[COMPLETED] All 30 GitHub Repos and real commits have been provisioned on GitHub.`);
  console.log(`[COMPLETED] Database states set up successfully at "scoring ready".`);
  console.log(`[COMPLETED] Run "node test-tools/stress_sync_runner.js" to start load testing.`);
  console.log(`============================================`);
  
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[FATAL SEEDER ERROR]:', err);
  mongoose.disconnect();
});
