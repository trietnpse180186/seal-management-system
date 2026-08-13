const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL;

let notificationQueue = null;
let redisConnection = null;
let isRedisAvailable = false;

/**
 * Initializes the Redis connection and BullMQ Queue.
 * Called once at server startup.
 */
function initQueue() {
  if (!REDIS_URL) {
    console.warn('[QUEUE] REDIS_URL not set. Notification queue disabled — falling back to synchronous mode.');
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
      console.log('[QUEUE] Redis connected successfully. Notification queue is active.');
    });

    redisConnection.on('error', (err) => {
      isRedisAvailable = false;
      console.error('[QUEUE] Redis connection error:', err.message);
    });

    notificationQueue = new Queue('notifications', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s → 25s → 125s
        },
        removeOnComplete: { count: 100 }, // Keep last 100 completed jobs
        removeOnFail: { count: 200 },     // Keep last 200 failed jobs
      },
    });

    console.log('[QUEUE] BullMQ notification queue initialized.');
  } catch (err) {
    console.error('[QUEUE] Failed to initialize notification queue:', err.message);
  }
}

/**
 * Adds an email job to the queue.
 * Falls back gracefully if Redis is not available.
 * @param {Object} data
 * @param {string} data.type - 'email_verify' | 'team_invite' | 'event_open'
 * @param {string} data.email - Recipient email
 * @param {Object} data - Additional fields depending on type
 */
async function addEmailJob(data) {
  if (!notificationQueue || !isRedisAvailable) {
    console.warn(`[QUEUE] Redis unavailable. Email job (${data.type}) skipped — falling back to synchronous call.`);
    return null;
  }

  try {
    const job = await notificationQueue.add('send_email', data);
    console.log(`[QUEUE] Email job #${job.id} enqueued: type=${data.type}, to=${data.email}`);
    return job;
  } catch (err) {
    console.error(`[QUEUE] Failed to enqueue email job (${data.type}):`, err.message);
    return null;
  }
}

/**
 * Adds an email job with a staggered delay (for bulk sending).
 * @param {Object} data
 * @param {number} [delayMs=0]
 */
async function addEmailJobWithDelay(data, delayMs = 0, options = {}) {
  if (!notificationQueue || !isRedisAvailable) {
    console.warn(`[QUEUE] Redis unavailable. Delayed email job (${data.type}) skipped.`);
    return null;
  }
  try {
    const job = await notificationQueue.add('send_email', data, { delay: delayMs, ...options });
    console.log(`[QUEUE] Email job #${job.id} enqueued with ${delayMs}ms delay: type=${data.type}, to=${data.email}`);
    return job;
  } catch (err) {
    console.error(`[QUEUE] Failed to enqueue delayed email job (${data.type}):`, err.message);
    return null;
  }
}

/**
 * Adds an in-app notification job to the queue.
 * Falls back gracefully if Redis is not available.
 * @param {Object} data
 * @param {string} data.userId - Target user's MongoDB ObjectId
 * @param {string} data.type - Notification type
 * @param {string} data.title - Notification title
 * @param {string} data.body - Notification body
 * @param {Object} [data.metadata] - Optional extra data
 */
async function addInAppJob(data) {
  if (!notificationQueue || !isRedisAvailable) {
    console.warn(`[QUEUE] Redis unavailable. In-app job (${data.type}) skipped — falling back to synchronous save.`);
    return null;
  }

  try {
    const job = await notificationQueue.add('save_in_app', data);
    console.log(`[QUEUE] In-app job #${job.id} enqueued: type=${data.type}, userId=${data.userId}`);
    return job;
  } catch (err) {
    console.error(`[QUEUE] Failed to enqueue in-app job (${data.type}):`, err.message);
    return null;
  }
}

/**
 * Returns whether Redis queue is currently available.
 */
function isQueueAvailable() {
  return isRedisAvailable && notificationQueue !== null;
}

module.exports = {
  initQueue,
  addEmailJob,
  addEmailJobWithDelay,
  addInAppJob,
  isQueueAvailable,
  getQueue: () => notificationQueue,
  getConnection: () => redisConnection,
};
