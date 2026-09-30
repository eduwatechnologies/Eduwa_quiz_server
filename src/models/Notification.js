const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    icon: { type: String, default: "bell" },
    colorKey: { type: String, default: "primary" },
    title: { type: String, required: true },
    text: { type: String, required: true },
    read: { type: Boolean, default: false },
    deepLink: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
