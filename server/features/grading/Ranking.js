const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RankingSchema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  trackId: { type: Schema.Types.ObjectId, ref: 'Track', required: true },
  roundId: { type: Schema.Types.ObjectId, ref: 'Round', required: true },
  teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
  repositoryId: { type: Schema.Types.ObjectId, ref: 'GithubRepository' },
  averageScore: { type: Number },
  finalScore: { type: Number },
  judgeCount: { type: Number },
  rank: { type: Number },
  isAdvanced: { type: Boolean, default: false },
  status: { type: String, default: 'draft' },
  calculatedAt: { type: Date },
  publishedAt: { type: Date }
}, {
  timestamps: true
});

RankingSchema.index({ eventId: 1, trackId: 1, roundId: 1, rank: 1 });
RankingSchema.index({ roundId: 1, teamId: 1 }, { unique: true });

module.exports = mongoose.model('Ranking', RankingSchema);