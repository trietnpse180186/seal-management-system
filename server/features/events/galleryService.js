const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { isDriveConfigured } = require('./driveAccessService');
const jwt = require('jsonwebtoken');
const GalleryPhoto = require('./GalleryPhoto');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');

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

// Help determine FPTU semester from date
function getSemesterFromDate(dateInput) {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'Spring 2026';
  const month = date.getMonth() + 1; // 1-indexed
  const year = date.getFullYear();

  // FPTU Semesters: Spring (Jan-Apr), Summer (May-Aug), Fall (Sep-Dec)
  if (month >= 1 && month <= 4) {
    return `Spring ${year}`;
  } else if (month >= 5 && month <= 8) {
    return `Summer ${year}`;
  } else {
    return `Fall ${year}`;
  }
}

// Helper to download a file from a URL to local path
async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download: ${res.statusText}`);
  }
  const fileStream = fs.createWriteStream(destPath);
  await pipeline(Readable.fromWeb(res.body), fileStream);
}

// 1. READ SYNCD DATA FROM MONGODB (Fast)
async function getGalleryData(backendOrigin = '') {
  try {
    const origin = process.env.BACKEND_URL || backendOrigin || 'http://localhost:5000';
    // Fetch photos sorted by newest first
    const photosList = await GalleryPhoto.find({}).sort({ createdTime: -1 }).lean();

    // Group and calculate counts per semester
    const semestersMap = {};
    const photos = photosList.map(p => {
      semestersMap[p.category] = (semestersMap[p.category] || 0) + 1;
      return {
        id: p.driveFileId,
        name: p.name,
        size: p.size,
        category: p.category,
        url: `${origin}${p.localPath}` // Local static path with backend host url
      };
    });

    const categories = Object.keys(semestersMap).map(sem => ({
      id: sem,
      name: sem.toUpperCase(),
      count: semestersMap[sem]
    })).sort((a, b) => b.name.localeCompare(a.name));

    return { categories, photos };
  } catch (err) {
    console.error('[GALLERY] Error reading gallery data from DB:', err.message);
    return { categories: [], photos: [] };
  }
}

// 2. SYNC GALLERY DATA: FETCH LIST FROM DRIVE AND DOWNLOAD FILES
async function syncGalleryData(onProgress = () => {}) {
  console.log('[GALLERY] Starting Google Drive sync...');
  const uploadDir = path.resolve(__dirname, '../../public/uploads/gallery');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  let drivePhotosList = [];

  // Send status: fetching file list
  onProgress({ status: 'fetching', percent: 0, current: 0, total: 0 });

  // Pathway A: Google Apps Script Web App
  const webAppUrl = process.env.GOOGLE_DRIVE_WEB_APP_URL;
  if (webAppUrl) {
    try {
      console.log('[GALLERY SYNC] Fetching image list from Google Apps Script Web App...');
      const res = await fetch(webAppUrl);
      if (res.ok) {
        const data = await res.json();
        drivePhotosList = data.photos || [];
      } else {
        console.warn(`[GALLERY SYNC] Apps Script returned status ${res.status}.`);
      }
    } catch (err) {
      console.error('[GALLERY SYNC] Apps Script fetch error:', err.message);
    }
  }

  // Pathway B: Direct Service Account Drive API (if Web App failed or is not defined)
  if (drivePhotosList.length === 0) {
    const galleryFolderId = process.env.GOOGLE_DRIVE_GALLERY_FOLDER_ID;
    if (isDriveConfigured() && galleryFolderId) {
      try {
        console.log('[GALLERY SYNC] Fetching image list via Google Drive API...');
        const accessToken = await getAccessToken();

        const subfoldersUrl = `https://www.googleapis.com/drive/v3/files?q='${galleryFolderId}'+in+parents+and+mimeType='application/vnd.google-apps.folder'+and+explicitlyTrashed=false&fields=files(id,name)&access_token=${accessToken}`;
        const subfoldersRes = await fetch(subfoldersUrl);

        if (subfoldersRes.ok) {
          const subfoldersData = await subfoldersRes.json();
          const subfolders = subfoldersData.files || [];

          if (subfolders.length === 0) {
            // No subfolders, query files directly
            const filesUrl = `https://www.googleapis.com/drive/v3/files?q='${galleryFolderId}'+in+parents+and+mimeType+contains+'image/'+and+explicitlyTrashed=false&fields=files(id,name,size,createdTime)&pageSize=1000&access_token=${accessToken}`;
            const filesRes = await fetch(filesUrl);
            if (filesRes.ok) {
              const filesData = await filesRes.json();
              drivePhotosList = filesData.files || [];
            }
          } else {
            // Fetch files inside each subfolder
            for (const folder of subfolders) {
              const filesUrl = `https://www.googleapis.com/drive/v3/files?q='${folder.id}'+in+parents+and+mimeType+contains+'image/'+and+explicitlyTrashed=false&fields=files(id,name,size,createdTime)&pageSize=1000&access_token=${accessToken}`;
              const filesRes = await fetch(filesUrl);
              if (filesRes.ok) {
                const filesData = await filesRes.json();
                drivePhotosList = drivePhotosList.concat(filesData.files || []);
              }
            }
          }
        }
      } catch (err) {
        console.error('[GALLERY SYNC] Direct Drive API fetch error:', err.message);
      }
    }
  }

  if (drivePhotosList.length === 0) {
    console.log('[GALLERY SYNC] No images found on Google Drive.');
    const result = { success: false, message: 'Không tìm thấy ảnh nào trên Google Drive để đồng bộ.' };
    onProgress({ success: false, message: result.message, percent: 100 });
    return result;
  }

  console.log(`[GALLERY SYNC] Found ${drivePhotosList.length} images on Drive. Syncing...`);

  // Optimize DB Query: Fetch all existing file IDs from database in one query
  const existingPhotos = await GalleryPhoto.find({}, { driveFileId: 1 }).lean();
  const existingFileIds = new Set(existingPhotos.map(p => p.driveFileId));

  const driveFileIds = new Set();
  let downloadedCount = 0;
  const total = drivePhotosList.length;

  onProgress({ status: 'syncing', percent: 0, current: 0, total });

  for (let i = 0; i < total; i++) {
    const photo = drivePhotosList[i];
    const fileId = photo.id;
    driveFileIds.add(fileId);

    // Normalise photo metadata
    const name = photo.name || `photo_${fileId}.jpg`;
    const size = photo.size ? (typeof photo.size === 'string' ? photo.size : formatBytes(photo.size)) : '0.00 MB';
    const createdTimeStr = photo.createdTime || new Date().toISOString();
    const semester = photo.category && photo.category.includes(' ') 
      ? photo.category 
      : getSemesterFromDate(createdTimeStr);

    const ext = path.extname(name) || '.jpg';
    const localFileName = `${fileId}${ext}`;
    const localFilePath = path.join(uploadDir, localFileName);
    const localPathUrl = `/uploads/gallery/${localFileName}`;

    const existsInDb = existingFileIds.has(fileId);
    const existsOnDisk = fs.existsSync(localFilePath);

    if (!existsInDb || !existsOnDisk) {
      try {
        console.log(`[GALLERY SYNC] Downloading: ${name} (${size})`);
        const downloadUrl = `https://lh3.googleusercontent.com/d/${fileId}=w1000`;
        try {
          await downloadFile(downloadUrl, localFilePath);
        } catch (downloadErr) {
          console.warn(`[GALLERY SYNC] w1000 download failed, falling back to original drive file:`, downloadErr.message);
          const fallbackUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
          await downloadFile(fallbackUrl, localFilePath);
        }

        if (!existsInDb) {
          await GalleryPhoto.create({
            driveFileId: fileId,
            name,
            size,
            category: semester,
            createdTime: new Date(createdTimeStr),
            localPath: localPathUrl
          });
        }
        downloadedCount++;
      } catch (downloadErr) {
        console.error(`[GALLERY SYNC] Failed to download file ${fileId}:`, downloadErr.message);
      }
    }

    // Send progress updates (throttle to every 10 photos, or when finished, to avoid SSE network flood)
    if (i % 10 === 0 || i === total - 1) {
      const percent = Math.floor(((i + 1) / total) * 100);
      onProgress({ status: 'syncing', percent, current: i + 1, total });
    }
  }

  // CLEAN UP: Remove files that are in MongoDB / Local but no longer on Google Drive
  const localPhotos = await GalleryPhoto.find({});
  let deletedCount = 0;

  for (const localPhoto of localPhotos) {
    if (!driveFileIds.has(localPhoto.driveFileId)) {
      console.log(`[GALLERY SYNC] Cleaning up deleted file: ${localPhoto.name}`);
      const ext = path.extname(localPhoto.name) || '.jpg';
      const localFilePath = path.join(uploadDir, `${localPhoto.driveFileId}${ext}`);
      
      if (fs.existsSync(localFilePath)) {
        try {
          fs.unlinkSync(localFilePath);
        } catch (err) {
          console.error(`[GALLERY SYNC] Failed to delete file ${localFilePath}:`, err.message);
        }
      }

      await GalleryPhoto.deleteOne({ _id: localPhoto._id });
      deletedCount++;
    }
  }

  console.log(`[GALLERY SYNC] Sync completed. Downloaded: ${downloadedCount}, Deleted: ${deletedCount}`);
  
  let message = 'Album ảnh đã được cập nhật mới nhất!';
  if (downloadedCount > 0 && deletedCount > 0) {
    message = `Đồng bộ thành công! Đã tải thêm ${downloadedCount} ảnh mới và dọn dẹp ${deletedCount} ảnh cũ.`;
  } else if (downloadedCount > 0) {
    message = `Đồng bộ thành công! Đã tải thêm ${downloadedCount} ảnh mới.`;
  } else if (deletedCount > 0) {
    message = `Đồng bộ thành công! Đã dọn dẹp ${deletedCount} ảnh đã bị xóa khỏi Drive.`;
  }

  const result = {
    success: true,
    message,
    downloadedCount,
    deletedCount
  };
  
  onProgress({ ...result, percent: 100 });
  return result;
}

module.exports = {
  getGalleryData,
  syncGalleryData,
  getAccessToken
};
