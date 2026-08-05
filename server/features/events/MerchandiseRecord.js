const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DistributionHistorySchema = new Schema({
  action: {
    type: String,
    enum: ['distributed', 'revoked', 'exchanged'],
    required: true
  },
  size: { type: String },
  performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  performedAt: { type: Date, default: Date.now },
  reason: { type: String }
}, { _id: false });

const MerchandiseRecordSchema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  itemType: {
    type: String,
    enum: ['shirt', 'badge', 'other'],
    default: 'shirt',
    required: true
  },
  size: { type: String },
  isDistributed: { type: Boolean, default: false, required: true },
  distributedAt: { type: Date },
  distributedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  distributionHistory: [DistributionHistorySchema]
}, {
  timestamps: true
});

// Indexes for fast query performance
MerchandiseRecordSchema.index({ eventId: 1, userId: 1, itemType: 1 }, { unique: true });
MerchandiseRecordSchema.index({ eventId: 1, isDistributed: 1 });

module.exports = mongoose.model('MerchandiseRecord', MerchandiseRecordSchema);
