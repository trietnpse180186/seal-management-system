const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PrizeSchema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  trackId: { type: Schema.Types.ObjectId, ref: 'Track' },
  roundId: { type: Schema.Types.ObjectId, ref: 'Round' },
  teamId: { type: Schema.Types.ObjectId, ref: 'Team' },
  rank: { type: Number },
  title: { type: String },
  description: { type: String },
  value: { type: String },
  announcedAt: { type: Date }
}, {
  timestamps: true
});

PrizeSchema.index({ eventId: 1, trackId: 1, roundId: 1, rank: 1 });

module.exports = mongoose.model('Prize', PrizeSchema);