// server/models/GradingLevel.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Mô tả một mức chấm điểm bên trong một Criterion
const GradingLevelSchema = new Schema({
  label: { type: String, required: true },
  minScore: { type: Number, required: true },
  maxScore: { type: Number, required: true },
  description: { type: String, default: '' }
}, {
  _id: true
});

module.exports = GradingLevelSchema;