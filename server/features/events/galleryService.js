const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { isDriveConfigured, assertDriveConfigured } = require('./driveAccessService');
const jwt = require('jsonwebtoken');

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const TOKEN_AUD = 'https://oauth2.googleapis.com/token';

function getServiceAccount() {
  try {
    if (process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON) {
      return JSON.parse(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON);
    }
    if (process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH) {
      const filePath = path.isAbsolute(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH)
        ? process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH
        : path.resolve(__dirname, '../../', process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PATH);
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    }
  } catch (err) {
    console.error('[GALLERY DRIVE] Failed to load service account:', err.message);
  }
  return null;
}

async function getAccessToken() {
  const sa = getServiceAccount();
  if (!sa?.client_email || !sa?.private_key) {
    throw new Error('Google Drive service account credentials missing.');
  }

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
    throw new Error(`Token exchange failed: ${errText}`);
  }

  const data = await res.json();
  return data.access_token;
}

function formatBytes(bytes) {
  if (!bytes) return '0.00 MB';
  const num = parseInt(bytes);
  if (isNaN(num)) return '0.00 MB';
  const mb = num / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

// MAIN SERVICE FUNCTION TO FETCH GALLERY DATA
async function getGalleryData() {
  const webAppUrl = process.env.GOOGLE_DRIVE_WEB_APP_URL;
  if (webAppUrl) {
    try {
      console.log('[GALLERY] Fetching gallery data from Google Apps Script Web App...');
      const res = await fetch(webAppUrl);
      if (res.ok) {
        const data = await res.json();
        return data;
      }
      console.warn(`[GALLERY] Google Apps Script returned status ${res.status}.`);
    } catch (err) {
      console.error('[GALLERY] Error fetching from Google Apps Script:', err.message);
    }
    return { categories: [], photos: [] };
  }

  const galleryFolderId = process.env.GOOGLE_DRIVE_GALLERY_FOLDER_ID;

  if (!isDriveConfigured() || !galleryFolderId) {
    console.log('[GALLERY] Google Drive is not configured or GOOGLE_DRIVE_GALLERY_FOLDER_ID is missing.');
    return { categories: [], photos: [] };
  }

  try {
    const accessToken = await getAccessToken();

    // 1. Get subfolders of the parent gallery folder to represent categories
    const subfoldersUrl = `https://www.googleapis.com/drive/v3/files?q='${galleryFolderId}'+in+parents+and+mimeType='application/vnd.google-apps.folder'+and+explicitlyTrashed=false&fields=files(id,name)&access_token=${accessToken}`;
    const subfoldersRes = await fetch(subfoldersUrl);

    if (!subfoldersRes.ok) {
      console.warn(`[GALLERY] Failed to list subfolders: ${subfoldersRes.statusText}.`);
      return { categories: [], photos: [] };
    }

    const subfoldersData = await subfoldersRes.json();
    const subfolders = subfoldersData.files || [];

    if (subfolders.length === 0) {
      // If there are no subfolders, let's just treat all files directly in the parent folder as one category
      const filesUrl = `https://www.googleapis.com/drive/v3/files?q='${galleryFolderId}'+in+parents+and+mimeType+contains+'image/'+and+explicitlyTrashed=false&fields=files(id,name,size)&pageSize=1000&access_token=${accessToken}`;
      const filesRes = await fetch(filesUrl);
      if (!filesRes.ok) return { categories: [], photos: [] };

      const filesData = await filesRes.json();
      const files = filesData.files || [];

      const categories = [{ id: 'all_photos', name: 'Tất cả ảnh', count: files.length }];
      const photos = files.map(file => ({
        id: file.id,
        name: file.name,
        size: formatBytes(file.size),
        category: 'all_photos',
        url: `/api/gallery/image/${file.id}`
      }));

      return { categories, photos };
    }

    // 2. Fetch image files inside each subfolder
    const categories = [];
    const photos = [];

    for (const folder of subfolders) {
      const filesUrl = `https://www.googleapis.com/drive/v3/files?q='${folder.id}'+in+parents+and+mimeType+contains+'image/'+and+explicitlyTrashed=false&fields=files(id,name,size)&pageSize=1000&access_token=${accessToken}`;
      const filesRes = await fetch(filesUrl);

      if (filesRes.ok) {
        const filesData = await filesRes.json();
        const files = filesData.files || [];

        categories.push({
          id: folder.id,
          name: folder.name,
          count: files.length
        });

        files.forEach(file => {
          photos.push({
            id: file.id,
            name: file.name,
            size: formatBytes(file.size),
            category: folder.id,
            url: `/api/gallery/image/${file.id}`
          });
        });
      }
    }

    return { categories, photos };
  } catch (err) {
    console.error('[GALLERY] Error fetching from Google Drive:', err.message);
    return { categories: [], photos: [] };
  }
}

module.exports = {
  getGalleryData,
  getAccessToken
};
