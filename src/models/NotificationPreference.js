const mongoose = require("mongoose");

const pushDeviceTokenSubSchema = new mongoose.Schema(
  {
    token: { type: String, required: true },
    platform: { type: String, enum: ["android", "ios"], required: true },
  },
  { _id: false }
);

const notificationPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    dailyReminder: { type: Boolean, default: true },
    streakAlerts: { type: Boolean, default: true },
    weeklySummary: { type: Boolean, default: false },
    examCountdown: { type: Boolean, default: true },
    reminderTime: { type: String, default: "08:00" }, // "HH:mm", 24h, local to `timezone`
    timezone: { type: String, default: "Africa/Lagos" }, // IANA tz name
    lastDailyReminderSentOn: { type: String, default: null }, // "yyyy-mm-dd", dedupes within a day
    lastStreakAlertAt: { type: Date, default: null }, // dedupe: one streak alert per gap
    lastExamCountdownDaysSent: { type: Number, default: null }, // dedupe: 30/7/1 sent once each
    pushDeviceTokens: { type: [pushDeviceTokenSubSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("NotificationPreference", notificationPreferenceSchema);
