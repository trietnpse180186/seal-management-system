const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Notification = mongoose.model('Notification');
const { authenticateToken } = require('../auth/authMiddleware');

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for logged in user (newest first)
 * @access  Private
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(notifications);
  } catch (error) {
    console.error('Fetch Notifications Error:', error.message);
    res.status(500).json({ message: 'Server error retrieving notifications.' });
  }
});

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count for the logged in user (for badge)
 * @access  Private
 */
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user._id,
      isRead: false,
      channel: 'in_app',
    });

    res.json({ count });
  } catch (error) {
    console.error('Unread Count Error:', error.message);
    res.status(500).json({ message: 'Server error retrieving unread count.' });
  }
});

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all in-app notifications as read for logged in user
 * @access  Private
 */
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false, channel: 'in_app' },
      { $set: { isRead: true } }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark All Notifications Read Error:', error.message);
    res.status(500).json({ message: 'Server error updating notifications.' });
  }
});

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark a single notification as read
 * @access  Private
 */
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    console.error('Mark Notification Read Error:', error.message);
    res.status(500).json({ message: 'Server error updating notification.' });
  }
});

module.exports = router;
