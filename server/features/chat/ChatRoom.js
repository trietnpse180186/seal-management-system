const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  mentorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

// Prevent duplicate rooms for the same team and mentor
chatRoomSchema.index({ teamId: 1, mentorId: 1 }, { unique: true });

mongoose.model('ChatRoom', chatRoomSchema);
