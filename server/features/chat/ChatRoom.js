const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  mentorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  trackId: { type: mongoose.Schema.Types.ObjectId, ref: 'Track' },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  type: { type: String, enum: ['team_mentor', 'track_mentors'], default: 'team_mentor' },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

// Prevent duplicate rooms for the same team and mentor
chatRoomSchema.index(
  { teamId: 1, mentorId: 1 },
  { unique: true, partialFilterExpression: { teamId: { $exists: true }, mentorId: { $exists: true } } }
);

// Prevent duplicate rooms for the same track and type
chatRoomSchema.index(
  { trackId: 1, type: 1 },
  { unique: true, partialFilterExpression: { trackId: { $exists: true }, type: 'track_mentors' } }
);

mongoose.model('ChatRoom', chatRoomSchema);
