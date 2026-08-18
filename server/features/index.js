const express = require('express');
const router = express.Router();

/* GET API index */
router.get('/', function(req, res, next) {
  res.json({
    status: 'online',
    systemName: 'SEAL Hackathon Platform Backend API',
    version: '1.0.0',
    timestamp: new Date()
  });
});

module.exports = router;
