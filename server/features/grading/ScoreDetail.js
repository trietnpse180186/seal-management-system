const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ScoreDetailSchema = new Schema({
  scoreId: { type: Schema.Types.ObjectId, ref: 'Score', required: true },
  criterionId: { type: Schema.Types.ObjectId, ref: 'Criterion', required: true },
  scoreValue: { type: Number, required: true },
  weightedScore: { type: Number },
  comment: { type: String }
}, {
  timestamps: true
});

ScoreDetailSchema.index({ scoreId: 1, criterionId: 1 }, { unique: true });
ScoreDetailSchema.index({ criterionId: 1 });

module.exports = mongoose.model('ScoreDetail', ScoreDetailSchema);