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

async function restrictDriveFileAccess(fileId, accessToken) {
  if (!fileId) return { success: false, error: 'missing_file_id' };
  try {
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true&fields=permissions(id,type,role)`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!listRes.ok) {
      const errText = await listRes.text();
      console.error(`[DRIVE] List permissions failed for file ${fileId}: ${errText}`);
      return { success: false, error: errText };
    }

    const data = await listRes.json();
    const permissions = data.permissions || [];
    let restrictedCount = 0;

    for (const perm of permissions) {
      if (perm.type === 'anyone') {
        const delRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}/permissions/${perm.id}?supportsAllDrives=true`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        );

        if (delRes.ok) {
          restrictedCount++;
          console.log(`[DRIVE] Restricted public access for file ${fileId} (removed permission ID: ${perm.id})`);
        } else {
          const errText = await delRes.text();
          console.error(`[DRIVE] Failed to delete public permission ${perm.id}: ${errText}`);
        }
      }
    }

    return { success: true, restrictedCount };
  } catch (err) {
    console.error(`[DRIVE] restrictDriveFileAccess error for file ${fileId}:`, err.message);
    return { success: false, error: err.message };
  }
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

async function syncDriveAccessForTrack(trackId, accessToken) {
  const Track = mongoose.model('Track');
  const Team = mongoose.model('Team');
  const TeamMember = mongoose.model('TeamMember');

  const track = await Track.findById(trackId);
  if (!track?.examDriveFileId) {
    return { synced: 0, failed: [], total: 0 };
  }

  try {
    await restrictDriveFileAccess(track.examDriveFileId, accessToken);
  } catch (err) {
    console.error(`[DRIVE] Failed to restrict file access for track ${track.name}:`, err.message);
  }

  const teams = await Team.find({ trackId, status: 'confirmed' }).select('_id');
  if (!teams.length) return { synced: 0, failed: [], total: 0 };

  const teamIds = teams.map((t) => t._id);
  const members = await TeamMember.find({
    teamId: { $in: teamIds },
    confirmStatus: 'confirmed'
  }).populate('userId', 'email isActive');

  const emails = new Set();
  for (const member of members) {
    if (member.userId?.isActive && member.userId.email) {
      emails.add(member.userId.email.toLowerCase().trim());
    }
  }
  const emailList = Array.from(emails);
  const failed = [];
  let synced = 0;

  for (let i = 0; i < emailList.length; i += BATCH_SIZE) {
    const batch = emailList.slice(i, i + BATCH_SIZE);
    for (const email of batch) {
      const result = await shareFileWithEmail(track.examDriveFileId, email, accessToken);
      if (result.success) synced += 1;
      else failed.push({ email, error: result.error });
    }
    if (i + BATCH_SIZE < emailList.length) await sleep(BATCH_DELAY_MS);
  }

  console.log(`[DRIVE] Track "${track.name}": synced ${synced}/${emailList.length}, failed ${failed.length}`);
  return { synced, failed, total: emailList.length };
}

async function syncDriveAccessForRound(roundId) {
  assertDriveConfigured();

  const round = await Round.findById(roundId);
  if (!round) {
    return { synced: 0, failed: [], total: 0 };
  }

  const accessToken = await getAccessToken();
  const failed = [];
  let synced = 0;
  let total = 0;
  
  // Set to prevent duplicate operations on the same Drive File ID
  const processedFileIds = new Set();

  // 1. Sync Round-level drive access
  if (round.driveFileId) {
    processedFileIds.add(round.driveFileId);
    try {
      await restrictDriveFileAccess(round.driveFileId, accessToken);
    } catch (err) {
      console.error(`[DRIVE] Failed to restrict file access for round ${round.name}:`, err.message);
    }

    const emails = await getEligibleEmailsForRound(roundId);
    total += emails.length;

    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batch = emails.slice(i, i + BATCH_SIZE);
      for (const email of batch) {
        const result = await shareFileWithEmail(round.driveFileId, email, accessToken);
        if (result.success) synced += 1;
        else failed.push({ email, error: result.error });
      }
      if (i + BATCH_SIZE < emails.length) await sleep(BATCH_DELAY_MS);
    }
  }

  // 2. Sync Track-level drive access for all tracks in this round
  const Track = mongoose.model('Track');
  const tracks = await Track.find({ roundId: round._id });
  for (const track of tracks) {
    if (track.examDriveFileId) {
      // If this file ID was already processed (e.g. same link as Round or other Track), skip to avoid duplicate API calls
      if (processedFileIds.has(track.examDriveFileId)) {
        console.log(`[DRIVE] Skipping duplicate file ID ${track.examDriveFileId} for track "${track.name}"`);
        continue;
      }
      processedFileIds.add(track.examDriveFileId);

      const trackResult = await syncDriveAccessForTrack(track._id, accessToken);
      synced += trackResult.synced;
      failed.push(...trackResult.failed);
      total += trackResult.total;
    }
  }

  round.isDriveAccessSynced = (total > 0 && failed.length === 0);
  round.driveSyncedAt = new Date();
  round.driveSyncedEmailCount = synced;
  round.driveSyncErrors = failed.slice(0, 100);
  await round.save();

  console.log(`[DRIVE] Round "${round.name}": synced ${synced}/${total}, failed ${failed.length}`);
  return { synced, failed, total };
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
