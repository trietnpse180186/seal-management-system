const { Worker } = require('bullmq');
const mongoose = require('mongoose');
const IORedis = require('ioredis');
const emailService = require('./emailService');

let worker = null;
let workerConnection = null;

/**
 * Starts the BullMQ Worker that processes notification jobs.
 * Should be called after MongoDB is connected.
 */
function startNotificationWorker() {
  const REDIS_URL = process.env.REDIS_URL;
  if (!REDIS_URL) {
    console.warn('[WORKER] REDIS_URL not set. Notification worker NOT started.');
    return;
  }

  workerConnection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    tls: REDIS_URL.startsWith('rediss://') ? {} : undefined,
  });

  workerConnection.on('error', (err) => {
    console.error('[WORKER] Redis connection error:', err.message);
  });

  worker = new Worker(
    'notifications',
    async (job) => {
      const { name: jobName, data, id: jobId } = job;

      if (jobName === 'send_email') {
        await handleEmailJob(jobId, data);
      } else if (jobName === 'save_in_app') {
        await handleInAppJob(jobId, data);
      } else {
        console.warn(`[WORKER] Unknown job type: ${jobName}`);
      }
    },
    {
      connection: workerConnection,
      concurrency: 5, // Process up to 5 jobs in parallel
    }
  );

  worker.on('completed', (job) => {
    console.log(`[WORKER] Job #${job.id} (${job.name}) completed successfully.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[WORKER] Job #${job?.id} (${job?.name}) failed after ${job?.attemptsMade} attempt(s): ${err.message}`);
  });

  let isLimitPaused = false;
  worker.on('error', (err) => {
    console.error('[WORKER] Worker error:', err.message);
    if (err.message.includes('max requests limit exceeded') && !isLimitPaused) {
      isLimitPaused = true;
      console.warn('[WORKER] Upstash Redis request limit reached. Pausing worker for 2 minutes to prevent log spam...');
      worker.pause().catch(e => console.error('[WORKER] Failed to pause:', e.message));
      setTimeout(() => {
        isLimitPaused = false;
        console.log('[WORKER] Resuming worker...');
        worker.resume().catch(e => console.error('[WORKER] Failed to resume:', e.message));
      }, 120000);
    }
  });

  console.log('[WORKER] Notification worker started and listening for jobs...');
}

/**
 * Handles email sending jobs.
 * Supported types: email_verify, team_invite, event_open
 */
async function handleEmailJob(jobId, data) {
  const { type } = data;
  console.log(`[WORKER] Processing email job #${jobId}: type=${type}, to=${data.email}`);

  switch (type) {
    case 'email_verify':
      await emailService.sendEmailVerification(data.email, data.fullName, data.verifyLink);
      break;

    case 'team_invite':
      await emailService.sendTeamInvitation(
        data.email,
        data.teamName,
        data.inviteLink,
        data.leaderName,
        data.leaderEmail,
        data.eventName,
        data.role || 'member',
        data.seminar,
        data.fullName
      );
      break;

    case 'event_open':
      await emailService.sendEventCreationNotification(
        data.email,
        data.fullName,
        data.eventName,
        data.semester,
        data.year
      );
      break;

    default:
      throw new Error(`Unknown email job type: ${type}`);
  }

  // Optionally update a Notification doc if a userId was provided (for email tracking)
  if (data.notificationId) {
    try {
      const Notification = mongoose.model('Notification');
      await Notification.findByIdAndUpdate(data.notificationId, {
        status: 'sent',
        sentAt: new Date(),
      });
    } catch (err) {
      console.warn(`[WORKER] Could not update Notification doc ${data.notificationId}:`, err.message);
    }
  }
}

/**
 * Handles in-app notification save jobs.
 * Creates a Notification document in MongoDB.
 */
async function handleInAppJob(jobId, data) {
  console.log(`[WORKER] Processing in-app job #${jobId}: type=${data.type}, userId=${data.userId}`);

  const Notification = mongoose.model('Notification');
  const notification = new Notification({
    userId: data.userId,
    type: data.type,
    title: data.title,
    body: data.body,
    channel: 'in_app',
    status: 'sent',
    metadata: data.metadata || {},
    sentAt: new Date(),
  });

  await notification.save();
  console.log(`[WORKER] In-app notification saved: ${notification._id}`);
}

/**
 * Gracefully shuts down the worker.
 */
async function stopNotificationWorker() {
  if (worker) {
    await worker.close();
    console.log('[WORKER] Notification worker stopped.');
  }
  if (workerConnection) {
    await workerConnection.quit();
    console.log('[WORKER] Redis connection for notification worker closed.');
  }
}

module.exports = {
  startNotificationWorker,
  stopNotificationWorker,
};
