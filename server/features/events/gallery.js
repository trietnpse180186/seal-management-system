const express = require('express');
const router = express.Router();
const { getGalleryData, getAccessToken } = require('./galleryService');
const stream = require('stream');

/**
 * @route   GET /api/gallery
 * @desc    Get photo album categories and photos
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const data = await getGalleryData();
    res.json(data);
  } catch (error) {
    console.error('Get Gallery Data Error:', error.message);
    res.status(500).json({ message: 'Lỗi hệ thống khi tải album ảnh.' });
  }
});

/**
 * @route   GET /api/gallery/image/:fileId
 * @desc    Proxy image content stream from Google Drive
 * @access  Public
 */
router.get('/image/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;

    // Check if it is a mock image id (just in case)
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
    
    // Support browser caching for gallery images
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day

    stream.Readable.fromWeb(driveRes.body).pipe(res);
  } catch (error) {
    console.error('[GALLERY PROXY ERROR]:', error.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
