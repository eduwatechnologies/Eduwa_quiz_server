const mongoose = require("mongoose");

const coachMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "coach"], required: true },
    text: { type: String, required: true },
    tokensUsed: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const coachSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    voiceProfileId: { type: String, default: "juniper-default" },
    messages: { type: [coachMessageSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CoachSession", coachSessionSchema);
