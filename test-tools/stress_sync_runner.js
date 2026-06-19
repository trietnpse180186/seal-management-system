const mongoose = require('../server/node_modules/mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

// Inject environment variables needed for server imports
process.env.NODE_ENV = 'development';

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/seal-hackathon';

// Helper for concurrency pool
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

async function main() {
  // Parse command-line args
  const args = process.argv.slice(2);
  let mode = 'concurrency'; // Default mode
  let limit = 3;            // Default concurrency limit

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode') {
      mode = args[i + 1];
    } else if (args[i] === '--limit') {
      limit = parseInt(args[i + 1], 10);
    }
  }

  console.log('====================================================');
  console.log(`[STRESS TEST] RUNNER STARTING`);
  console.log(`[STRESS TEST] Mode: ${mode.toUpperCase()}`);
  if (mode === 'concurrency') {
    console.log(`[STRESS TEST] Concurrency Limit: ${limit}`);
  }
  console.log('====================================================');

  console.log('[STRESS TEST] Connecting to database...');
  await mongoose.connect(mongoUri);
  
  console.log('[DEBUG] Mongoose version:', mongoose.version);
  console.log('[DEBUG] Resolving Event model path:', require.resolve('../server/features/events/Event'));
  
  // Register Mongoose models first (since cronService requires them to be registered)
  const EventModel = require('../server/features/events/Event');
  console.log('[DEBUG] Required Event model directly:', !!EventModel);
  console.log('[DEBUG] Is mongoose instance the same as EventModel.base?', mongoose === EventModel.base);
  console.log('[DEBUG] Is mongoose instance the same as EventModel.db.base?', mongoose === EventModel.db?.base);
  console.log('[DEBUG] EventModel modelName:', EventModel.modelName);
  console.log('[DEBUG] Mongoose models after Event require:', mongoose.modelNames());

  require('../server/features/events/Round');
  require('../server/features/events/Track');
  require('../server/features/events/Prize');
  require('../server/features/teams/Team');
  require('../server/features/teams/TeamMember');
  require('../server/features/auth/User');
  require('../server/features/auth/EventRole');
  require('../server/features/github-ai/GithubRepository');
  require('../server/features/github-ai/Commit');
  require('../server/features/github-ai/CommitFile');
  require('../server/features/github-ai/AiAnalysis');
  require('../server/features/grading/Rubric');
  require('../server/features/grading/Criterion');
  require('../server/features/notifications/Notification');

  console.log('[DEBUG] Final registered models:', mongoose.modelNames());

  const Event = mongoose.model('Event');
  const GithubRepository = mongoose.model('GithubRepository');

  // Find our stress test event
  const event = await Event.findOne({ name: 'Stress Test Hackathon 2026' });
  if (!event) {
    console.error('[ERROR] Stress Test Event not found. Please run "node test-tools/stress_data_generator.js" first.');
    await mongoose.disconnect();
    process.exit(1);
  }

  // Fetch repositories for this event
  const repos = await GithubRepository.find({ eventId: event._id });
  console.log(`[STRESS TEST] Found ${repos.length} repositories to synchronize.`);
  
  if (repos.length === 0) {
    console.error('[ERROR] No repositories linked to this event.');
    await mongoose.disconnect();
    process.exit(1);
  }

  // Import syncRepo function
  const { syncRepo } = require('../server/features/events/cronService');

  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;
  const results = [];

  // Iterator function
  const executeSync = async (repo) => {
    const repoStart = Date.now();
    console.log(`[SYNC RUN] Starting repo: ${repo.repoName}...`);
    
    // Call real backend sync function
    const success = await syncRepo(repo._id);
    const duration = ((Date.now() - repoStart) / 1000).toFixed(2);
    
    if (success) {
      successCount++;
      console.log(`[SYNC SUCCESS] Repo ${repo.repoName} finished in ${duration}s`);
    } else {
      failCount++;
      console.error(`[SYNC FAILED] Repo ${repo.repoName} failed in ${duration}s`);
    }

    results.push({
      repoName: repo.repoName,
      success,
      duration: parseFloat(duration)
    });
  };

  if (mode === 'sequential') {
    // Run one by one
    for (const repo of repos) {
      await executeSync(repo);
    }
  } else if (mode === 'parallel') {
    // Run all at once
    await Promise.all(repos.map(repo => executeSync(repo)));
  } else if (mode === 'concurrency') {
    // Run with limit
    await asyncPool(limit, repos, executeSync);
  } else {
    console.error(`[ERROR] Invalid mode: ${mode}. Use "sequential", "parallel", or "concurrency".`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const totalTimeSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const avgTime = (results.reduce((acc, r) => acc + r.duration, 0) / results.length).toFixed(2);

  console.log('\n====================================================');
  console.log(`[STRESS TEST COMPLETED]`);
  console.log(`Total duration: ${totalTimeSec}s`);
  console.log(`Successful syncs: ${successCount}/${repos.length}`);
  console.log(`Failed syncs: ${failCount}/${repos.length}`);
  console.log(`Average time per repository: ${avgTime}s`);
  console.log('====================================================\n');

  // Detailed statistics
  console.log('Detailed Report:');
  console.table(results.sort((a, b) => b.duration - a.duration));

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('[FATAL RUNNER ERROR]:', err);
  mongoose.disconnect();
});
