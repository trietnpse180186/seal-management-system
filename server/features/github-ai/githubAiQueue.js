const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL;

let githubAIQueue = null;
let redisConnection = null;
let isRedisAvailable = false;

/**
 * Initializes the Redis connection and BullMQ Queue.
 * Called once at server startup.
 */
function initQueue() {
  if (!REDIS_URL) {
    console.warn('[GITHUB AI QUEUE] REDIS_URL not set. GitHub AI queue disabled — falling back to asynchronous background processing.');
    return;
  }

  try {
    redisConnection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      tls: REDIS_URL.startsWith('rediss://') ? {} : undefined,
    });

    redisConnection.on('connect', () => {
      isRedisAvailable = true;
      console.log('[GITHUB AI QUEUE] Redis connected successfully. GitHub AI queue is active.');
    });

    redisConnection.on('error', (err) => {
      isRedisAvailable = false;
      console.error('[GITHUB AI QUEUE] Redis connection error:', err.message);
    });

    githubAIQueue = new Queue('github-ai', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000, // 10s → 50s → 250s
        },
        removeOnComplete: { count: 100 }, // Keep last 100 completed jobs
        removeOnFail: { count: 200 },     // Keep last 200 failed jobs
      },
    });

    console.log('[GITHUB AI QUEUE] BullMQ GitHub AI queue initialized.');
  } catch (err) {
    console.error('[GITHUB AI QUEUE] Failed to initialize GitHub AI queue:', err.message);
  }
}

/**
 * Adds a repository sync job to the queue.
 * Falls back gracefully if Redis is not available.
 * @param {string} repoId - MongoDB ObjectId of the GithubRepository
 */
async function addSyncJob(repoId) {
  if (!githubAIQueue || !isRedisAvailable) {
    console.warn(`[GITHUB AI QUEUE] Redis unavailable. Repository sync (repoId=${repoId}) will execute asynchronously in background.`);
    return null;
  }

  try {
    // Deduplicate jobs by using a specific jobId: sync-repoId
    // If a job with this ID is already waiting or active, BullMQ will ignore the duplicate add
    const job = await githubAIQueue.add('sync_repo', { repoId }, {
      jobId: `sync-${repoId}`
    });
    console.log(`[GITHUB AI QUEUE] Sync job #${job.id} enqueued for repoId=${repoId}`);
    return job;
  } catch (err) {
    console.error(`[GITHUB AI QUEUE] Failed to enqueue sync job for repoId=${repoId}:`, err.message);
    return null;
  }
}

/**
 * Returns whether Redis queue is currently available.
 */
function isQueueAvailable() {
  return isRedisAvailable && githubAIQueue !== null;
}

module.exports = {
  initQueue,
  addSyncJob,
  isQueueAvailable,
  getQueue: () => githubAIQueue,
  getConnection: () => redisConnection,
};
