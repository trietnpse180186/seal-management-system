const express = require('express');
const router = express.Router();
const { getGalleryData, syncGalleryData, getAccessToken } = require('./galleryService');
const stream = require('stream');

/**
 * @route   GET /api/gallery
 * @desc    Get photo album categories and photos (read from MongoDB)
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const backendOrigin = `${req.protocol}://${req.get('host')}`;
    const data = await getGalleryData(backendOrigin);
    res.json(data);
  } catch (error) {
    console.error('Get Gallery Data Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi tải album ảnh.' });
  }
});

/**
 * @route   GET /api/gallery/sync-progress
 * @desc    Sync images from Google Drive to local storage and stream real-time progress via SSE
 * @access  Public
 */
router.get('/sync-progress', async (req, res) => {
  // Set headers for Server-Sent Events (SSE)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // Establish connection immediately

  const onProgress = (data) => {
    // Send standard SSE message format
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await syncGalleryData(onProgress);
  } catch (error) {
    console.error('[GALLERY SYNC SSE ERROR]:', error.message);
    res.write(`data: ${JSON.stringify({ success: false, error: 'Lỗi hệ thống khi đồng bộ.' })}\n\n`);
  } finally {
    res.end(); // Terminate SSE stream when done
  }
});

/**
 * @route   GET /api/gallery/image/:fileId
 * @desc    Proxy image content stream from Google Drive (fallback proxy if direct link fails)
 * @access  Public
 */
router.get('/image/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;

    if (fileId.startsWith('mock_img_')) {
      return res.status(400).send('Mock image should be requested via direct Unsplash/Picsum URL.');
    }

    const accessToken = await getAccessToken();
    const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!driveRes.ok) {
      console.error(`[GALLERY PROXY] Failed to fetch media from Drive: ${driveRes.statusText}`);
      return res.status(404).send('Image not found');
    }

    const contentType = driveRes.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    
    res.setHeader('Cache-Control', 'public, max-age=86400');
    stream.Readable.fromWeb(driveRes.body).pipe(res);
  } catch (error) {
    console.error('[GALLERY PROXY ERROR]:', error.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
