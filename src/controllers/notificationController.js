const asyncHandler = require("../utils/asyncHandler");
const NotificationPreference = require("../models/NotificationPreference");
const Notification = require("../models/Notification");
const PushDeviceToken = require("../models/PushDeviceToken");

async function getOrCreatePrefs(userId) {
  let prefs = await NotificationPreference.findOne({ userId });
  if (!prefs) {
    prefs = await NotificationPreference.create({ userId });
  }
  return prefs;
}

const getPreferences = asyncHandler(async (req, res) => {
  const prefs = await getOrCreatePrefs(req.user._id);
  res.status(200).json({
    dailyReminder: prefs.dailyReminder,
    streakAlerts: prefs.streakAlerts,
    weeklySummary: prefs.weeklySummary,
    examCountdown: prefs.examCountdown,
    reminderTime: prefs.reminderTime,
    timezone: prefs.timezone,
    pushDeviceTokens: prefs.pushDeviceTokens,
  });
});

const updatePreferences = asyncHandler(async (req, res) => {
  const prefs = await getOrCreatePrefs(req.user._id);
  Object.assign(prefs, req.body);
  await prefs.save();

  // Keep the standalone push_device_tokens collection (used for admin/fanout
  // queries) in sync with whatever tokens were supplied.
  if (req.body.pushDeviceTokens) {
    for (const { token, platform } of req.body.pushDeviceTokens) {
      await PushDeviceToken.findOneAndUpdate(
        { token },
        { userId: req.user._id, token, platform, lastUsed: new Date() },
        { upsert: true }
      );
    }
  }

  res.status(200).json({
    dailyReminder: prefs.dailyReminder,
    streakAlerts: prefs.streakAlerts,
    weeklySummary: prefs.weeklySummary,
    examCountdown: prefs.examCountdown,
    reminderTime: prefs.reminderTime,
    timezone: prefs.timezone,
    pushDeviceTokens: prefs.pushDeviceTokens,
  });
});

const listNotifications = asyncHandler(async (req, res) => {
  const items = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50);
  const hasUnread = items.some((n) => !n.read);

  res.status(200).json({
    items: items.map((n) => ({
      id: n._id.toString(),
      icon: n.icon,
      colorKey: n.colorKey,
      title: n.title,
      text: n.text,
      time: n.createdAt,
      read: n.read,
      deepLink: n.deepLink,
    })),
    hasUnread,
  });
});

const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
  res.status(204).send();
});

module.exports = { getPreferences, updatePreferences, listNotifications, markAllRead };
