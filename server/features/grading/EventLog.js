const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const EventLogSchema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: false },
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  action: { type: String, required: true },
  details: { type: String, required: true },
  type: { type: String, enum: ['error', 'login', 'grading', 'operation', 'system'], default: 'operation' }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

EventLogSchema.index({ eventId: 1, createdAt: -1 });
EventLogSchema.index({ type: 1, createdAt: -1 });

EventLogSchema.post('save', async function(doc) {
  try {
    const socketModule = require('../chat/socket');
    const io = socketModule.getIO();
    const populated = await doc.populate([
      { path: 'actorId', select: 'fullName email' },
      { path: 'eventId', select: 'name semester year' }
    ]);
    io.emit('new_event_log', populated);
  } catch (err) {
    // Socket.io might not be initialized during setup scripts or tests, ignore
  }
});

module.exports = mongoose.model('EventLog', EventLogSchema);
