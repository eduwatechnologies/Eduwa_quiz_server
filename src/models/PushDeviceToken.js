const mongoose = require("mongoose");

const pushDeviceTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ["android", "ios"], required: true },
    lastUsed: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PushDeviceToken", pushDeviceTokenSchema);
