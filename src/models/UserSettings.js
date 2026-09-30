const mongoose = require("mongoose");

const userSettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    soundEffects: { type: Boolean, default: true },
    haptics: { type: Boolean, default: true },
    sponsoredContent: { type: Boolean, default: true },
    reducedMotion: { type: Boolean, default: false },
    dailyGoal: { type: Number, enum: [10, 20, 30], default: 10 },
    appVersion: { type: String, default: "0.0.0" }, // server-only, read-only to clients
    contentVersion: { type: String, default: "2026.01" }, // server-only, read-only to clients
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserSettings", userSettingsSchema);
