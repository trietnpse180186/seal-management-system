const { Worker } = require('bullmq');
const { getConnection } = require('./githubAiQueue');

let worker = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Starts the BullMQ Worker that processes GitHub AI sync jobs.
 * Should be called after MongoDB is connected.
 */
function startWorker() {
  const connection = getConnection();

  if (!connection) {
    console.warn('[GITHUB AI WORKER] Redis connection not available. GitHub AI worker NOT started.');
    return;
  }

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
        
        // Cooldown delay of 5 seconds to prevent hitting Gemini RPM rate limits
        console.log('[GITHUB AI WORKER] Cooldown sleep for 5 seconds to throttle AI requests...');
        await sleep(5000);
      } else {
        console.warn(`[GITHUB AI WORKER] Unknown job type: ${jobName}`);
      }
    },
    {
      connection,
      concurrency: 1, // Strictly process one repo at a time to prevent parallel Gemini requests
    }
  );

  worker.on('completed', (job) => {
    console.log(`[GITHUB AI WORKER] Job #${job.id} completed successfully.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[GITHUB AI WORKER] Job #${job?.id} failed after ${job?.attemptsMade} attempt(s): ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error('[GITHUB AI WORKER] Worker error:', err.message);
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
}

module.exports = {
  startWorker,
  stopWorker,
};
