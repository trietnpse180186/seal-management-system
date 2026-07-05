const { Worker } = require('bullmq');
const IORedis = require('ioredis');

let worker = null;
let workerConnection = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Starts the BullMQ Worker that processes GitHub AI sync jobs.
 * Should be called after MongoDB is connected.
 */
function startWorker() {
  const REDIS_URL = process.env.REDIS_URL;
  if (!REDIS_URL) {
    console.warn('[GITHUB AI WORKER] REDIS_URL not set. GitHub AI worker NOT started.');
    return;
  }

  workerConnection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    tls: REDIS_URL.startsWith('rediss://') ? {} : undefined,
  });

  workerConnection.on('error', (err) => {
    console.error('[GITHUB AI WORKER] Redis connection error:', err.message);
  });

  // Require cronService dynamically to avoid circular dependencies and ensure models are loaded first
  const cronService = require('../events/cronService');

  worker = new Worker(
    'github-ai',
    async (job) => {
      const { name: jobName, data, id: jobId } = job;
      console.log(`[GITHUB AI WORKER] Processing job #${jobId}: name=${jobName}, repoId=${data.repoId}`);

      if (jobName === 'sync_repo') {
        const startTime = Date.now();
        
        // Execute syncRepo which pulls commits, files, calls n8n (Vertex AI), and updates database
        await cronService.syncRepo(data.repoId);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[GITHUB AI WORKER] Job #${jobId} completed successfully in ${duration}s.`);
        
        // Cooldown delay of 12 seconds to throttle AI requests under 5 RPM Gemini limits
        console.log('[GITHUB AI WORKER] Cooldown sleep for 12 seconds...');
        await sleep(12000);
      } else {
        console.warn(`[GITHUB AI WORKER] Unknown job type: ${jobName}`);
      }
    },
    {
      connection: workerConnection,
      concurrency: 1, // Process 1 repo at a time to stay under Gemini rate limits
    }
  );

  worker.on('completed', (job) => {
    console.log(`[GITHUB AI WORKER] Job #${job.id} completed successfully.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[GITHUB AI WORKER] Job #${job?.id} failed after ${job?.attemptsMade} attempt(s): ${err.message}`);
  });

  let isLimitPaused = false;
  worker.on('error', (err) => {
    console.error('[GITHUB AI WORKER] Worker error:', err.message);
    if (err.message.includes('max requests limit exceeded') && !isLimitPaused) {
      isLimitPaused = true;
      console.warn('[GITHUB AI WORKER] Upstash Redis request limit reached. Pausing worker for 2 minutes to prevent log spam...');
      worker.pause().catch(e => console.error('[GITHUB AI WORKER] Failed to pause:', e.message));
      setTimeout(() => {
        isLimitPaused = false;
        console.log('[GITHUB AI WORKER] Resuming worker...');
        worker.resume().catch(e => console.error('[GITHUB AI WORKER] Failed to resume:', e.message));
      }, 120000);
    }
  });

  console.log('[GITHUB AI WORKER] GitHub AI worker started and listening for jobs...');
}

/**
 * Gracefully shuts down the worker.
 */
async function stopWorker() {
  if (worker) {
    await worker.close();
    console.log('[GITHUB AI WORKER] GitHub AI worker stopped.');
  }
  if (workerConnection) {
    await workerConnection.quit();
    console.log('[GITHUB AI WORKER] Redis connection for GitHub AI worker closed.');
  }
}

module.exports = {
  startWorker,
  stopWorker,
};
