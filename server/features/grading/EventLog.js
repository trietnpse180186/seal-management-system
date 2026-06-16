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

module.exports = mongoose.model('EventLog', EventLogSchema);
