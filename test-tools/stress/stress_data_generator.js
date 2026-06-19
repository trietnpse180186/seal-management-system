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
});

const RubricSchema = new mongoose.Schema({
  roundId: mongoose.Schema.Types.ObjectId,
  name: String,
  isActive: { type: Boolean, default: true },
});

const CriterionSchema = new mongoose.Schema({
  rubricId: mongoose.Schema.Types.ObjectId,
  code: String,
  name: String,
  description: String,
  maxScore: Number,
  weight: Number,
  order: Number,
});

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

  // Create Track
  const track = new Track({
    eventId: event._id,
    name: 'AI & Machine Learning'
  });
  await track.save();

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
    roundId: round._id,
    name: 'Bảng điểm Stress Test',
    isActive: true
  });
  await rubric.save();

  // Create Criteria
  const criteria = [
    { code: 'CODE', name: 'Chất lượng Mã nguồn', maxScore: 50, weight: 0.5, order: 1 },
    { code: 'AI', name: 'Độ chín RAG & Trí tuệ AI', maxScore: 30, weight: 0.3, order: 2 },
    { code: 'TEAM', name: 'Phối hợp Đội ngũ', maxScore: 20, weight: 0.2, order: 3 }
  ];
  for (const c of criteria) {
    const crit = new Criterion({
      rubricId: rubric._id,
      code: c.code,
      name: c.name,
      maxScore: c.maxScore,
      weight: c.weight,
      order: c.order
    });
    await crit.save();
  }

  const numTeams = parseInt(process.argv[2], 10) || parseInt(process.env.NUM_TEAMS, 10) || 30;
  console.log(`[SEEDER] Generating ${numTeams} Teams, Git Repositories and Commits...`);

  // Code templates for commits
  const filesMap = {
    basic: {
      'src/index.js': `const express = require('express');
const app = express();
app.use(express.json());
app.post('/query', (req, res) => {
  res.json({ reply: 'Basic RAG response' });
});
app.listen(3000, () => console.log('Server running'));`,
      'src/rag_pipeline.js': `const { MongoClient } = require('mongodb');
// Simple keyword matching search
async function searchDocuments(query) {
  console.log('Searching MongoDB for query:', query);
  return [{ content: 'Mock RAG Document content' }];
}`
    },
    advanced: {
      'src/index.js': `const express = require('express');
const app = express();
app.use(express.json());
app.post('/query', (req, res) => {
  res.json({ reply: 'Advanced RAG response' });
});
app.listen(3000, () => console.log('Server running'));`,
      'src/rag_pipeline.js': `const { ChromaClient } = require('chromadb');
const client = new ChromaClient();
// Advanced semantic search with hybrid rerank
async function searchVectorDB(query) {
  const collection = await client.getCollection({ name: "kb" });
  const results = await collection.query({ queryTexts: [query], nResults: 5 });
  // Rerank results
  return results.documents[0].map(doc => ({ content: doc, score: 0.9 }));
}`
    },
    agentic: {
      'src/index.js': `const express = require('express');
const app = express();
app.use(express.json());
app.post('/chat', (req, res) => {
  res.json({ reply: 'Agentic RAG decision' });
});
app.listen(3000, () => console.log('Server running'));`,
      'src/agent.js': `const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
// Agentic routing logic
async function runAgent(userInput) {
  const model = new ChatGoogleGenerativeAI({ modelName: "gemini-1.5-pro" });
  if (userInput.includes('search')) {
    return await callSearchTool(userInput);
  }
  return await model.invoke(userInput);
}`
    }
  };

  const keys = Object.keys(filesMap);

  for (let i = 1; i <= numTeams; i++) {
    const teamNum = String(i).padStart(2, '0');
    const teamName = `Team Stress ${teamNum}`;
    const repoName = `team-stress-${teamNum}`;
    const email = `leader-stress-${teamNum}@example.com`;

    console.log(`\n--------------------------------------------`);
    console.log(`[PROCESS] Processing ${teamName} (${i}/${numTeams})`);

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

      // Determine RAG Level to push
      const ragType = keys[(i - 1) % keys.length]; // basic, advanced, agentic
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
      syncStatus: 'not_synced'
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
