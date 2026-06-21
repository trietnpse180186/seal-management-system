const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const EventLogSchema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  details: { type: String, required: true }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

EventLogSchema.index({ eventId: 1, createdAt: -1 });

EventLogSchema.post('save', async function(doc) {
  try {
    const socketModule = require('../chat/socket');
    const io = socketModule.getIO();
    await doc.populate('actorId', 'fullName email');
    io.emit('new_event_log', doc);
  } catch (err) {
    // Socket.io might not be initialized during setup scripts or tests, ignore
  }
});

module.exports = mongoose.model('EventLog', EventLogSchema);
