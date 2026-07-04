const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const EventRoleSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    trackId: { type: Schema.Types.ObjectId, ref: "Track" },
    roundId: { type: Schema.Types.ObjectId, ref: "Round" },
    role: {
      type: String,
      enum: [
        "participant",
        "mentor",
        "judge",
        "coordinator",
        "admin_view",
      ],
      required: true,
    },
    judgeType: { type: String, enum: ["internal", "guest"] },
    status: { type: String, enum: ["active", "removed"], default: "active" },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User" },
    assignedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

EventRoleSchema.index(
  { userId: 1, eventId: 1, trackId: 1, roundId: 1, role: 1 },
  { unique: true },
);
EventRoleSchema.index({ eventId: 1, role: 1 });
EventRoleSchema.index({ eventId: 1, trackId: 1, role: 1 });
EventRoleSchema.index({ eventId: 1, roundId: 1, role: 1 });

module.exports = mongoose.model("EventRole", EventRoleSchema);
