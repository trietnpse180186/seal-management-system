const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RoundSchema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  name: { type: String, required: true },
  order: { type: Number, required: true },
  submissionDeadline: { type: Date },
  advanceTopN: { type: Number },
  status: { type: String, enum: ['pending', 'active', 'scoring', 'completed'], default: 'pending' }
}, {
  timestamps: true
});

RoundSchema.index({ eventId: 1, order: 1 }, { unique: true });

module.exports = mongoose.model('Round', RoundSchema);