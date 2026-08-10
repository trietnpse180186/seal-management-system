const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GradingAssistRequestSchema = new Schema({
  teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
  roundId: { type: Schema.Types.ObjectId, ref: 'Round', required: true },
  judgeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  coordinatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'auto_granted'],
    default: 'pending',
  },
  respondedAt: { type: Date },
  autoGrantedAt: { type: Date },
}, { timestamps: true });

GradingAssistRequestSchema.index(
  { teamId: 1, roundId: 1, judgeId: 1, coordinatorId: 1 },
  { unique: true },
);

module.exports = mongoose.model('GradingAssistRequest', GradingAssistRequestSchema);
