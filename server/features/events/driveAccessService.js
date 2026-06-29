const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const {
  getEligibleEmailsForRound,
  buildDriveUrl
} = require('./examAccessService');

const Round = mongoose.model('Round');

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const TOKEN_AUD = 'https://oauth2.googleapis.com/token';
const BATCH_SIZE = 40;
const BATCH_DELAY_MS = 1500;

const CONFIG_ERROR =
  'Google Drive chưa cấu hình. Thêm GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH (hoặc GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON) vào server/.env và đặt file JSON vào server/secrets/.';

function resolveKeyPath(envPath) {
  if (!envPath) return null;
  if (path.isAbsolute(envPath)) return envPath;
  return path.resolve(__dirname, '../../', envPath);
}

function isDriveConfigured() {
  return !!(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH);
}

function getServiceAccount() {
  try {
    if (process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON) {
      return JSON.parse(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON);
    }
    if (process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH) {
      const filePath = resolveKeyPath(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH);
      if (!filePath || !fs.existsSync(filePath)) {
        throw new Error(`Không tìm thấy file service account: ${filePath}`);
      }
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('[DRIVE] Failed to load service account:', err.message);
    throw err;
  }
  return null;
}

function assertDriveConfigured() {
  if (!isDriveConfigured()) {
    throw new Error(CONFIG_ERROR);
  }
  const sa = getServiceAccount();
  if (!sa?.client_email || !sa?.private_key) {
    throw new Error('File service account Google Drive thiếu client_email hoặc private_key.');
  }
  return sa;
}

async function getAccessToken() {
  const sa = assertDriveConfigured();

  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: sa.client_email,
      scope: DRIVE_SCOPE,
      aud: TOKEN_AUD,
      iat: now,
      exp: now + 3600
    },
    sa.private_key,
    { algorithm: 'RS256' }
  );

  const res = await fetch(TOKEN_AUD, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive token exchange failed: ${errText}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Drive token response missing access_token.');
  }
  return data.access_token;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function shareFileWithEmail(fileId, email, accessToken) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?sendNotificationEmail=false&supportsAllDrives=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'user',
        role: 'reader',
        emailAddress: email
      })
    }
  );

  if (res.ok) return { success: true };

  const errBody = await res.json().catch(() => ({}));
  const message = errBody?.error?.message || res.statusText;
  if (/already exists|Permission already granted/i.test(message)) {
    return { success: true, skipped: true };
  }
  return { success: false, error: message };
}

async function ensureUserDriveAccess(fileId, email) {
  if (!fileId || !email) {
    return { success: false, error: 'missing_params' };
  }

  try {
    const accessToken = await getAccessToken();
    return await shareFileWithEmail(fileId, email.toLowerCase().trim(), accessToken);
  } catch (err) {
    console.error(`[DRIVE] ensureUserDriveAccess failed for ${email}:`, err.message);
    return { success: false, error: err.message };
  }
}

async function syncDriveAccessForRound(roundId) {
  assertDriveConfigured();

  const round = await Round.findById(roundId);
  if (!round?.driveFileId) {
    return { synced: 0, failed: [], total: 0 };
  }

  const emails = await getEligibleEmailsForRound(roundId);
  const failed = [];
  let synced = 0;

  const accessToken = await getAccessToken();

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    for (const email of batch) {
      const result = await shareFileWithEmail(round.driveFileId, email, accessToken);
      if (result.success) synced += 1;
      else failed.push({ email, error: result.error });
    }
    if (i + BATCH_SIZE < emails.length) await sleep(BATCH_DELAY_MS);
  }

  round.isDriveAccessSynced = failed.length === 0;
  round.driveSyncedAt = new Date();
  round.driveSyncedEmailCount = synced;
  round.driveSyncErrors = failed.slice(0, 100);
  await round.save();

  console.log(`[DRIVE] Round "${round.name}": synced ${synced}/${emails.length}, failed ${failed.length}`);
  return { synced, failed, total: emails.length };
}

function getDriveStatus() {
  try {
    const sa = isDriveConfigured() ? getServiceAccount() : null;
    return {
      configured: isDriveConfigured(),
      serviceAccountEmail: sa?.client_email || null,
      keyFileReadable: !!(sa?.client_email && sa?.private_key)
    };
  } catch (err) {
    return {
      configured: false,
      serviceAccountEmail: null,
      keyFileReadable: false,
      error: err.message
    };
  }
}

async function validateDriveConnection() {
  try {
    const sa = assertDriveConfigured();
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Không lấy được access token từ Google.');
    }
    console.log(`[DRIVE] API ready — service account: ${sa.client_email}`);
    return { ok: true, serviceAccountEmail: sa.client_email };
  } catch (err) {
    console.error('[DRIVE] Startup validation failed:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  isDriveConfigured,
  assertDriveConfigured,
  getDriveStatus,
  validateDriveConnection,
  ensureUserDriveAccess,
  syncDriveAccessForRound,
  buildDriveUrl
};
