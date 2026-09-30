const Notification = require("../models/Notification");
const PushDeviceToken = require("../models/PushDeviceToken");
const { sendExpoPush } = require("./pushService");

/**
 * Creates an in-app Notification row AND pushes it to the user's registered
 * devices (if any). Used by both live user actions and the cron jobs in
 * jobs/notificationJobs.js.
 */
async function dispatchNotification(userId, { icon = "bell", colorKey = "primary", title, text, deepLink = null }) {
  await Notification.create({ userId, icon, colorKey, title, text, deepLink });

  const devices = await PushDeviceToken.find({ userId }).select("token");
  if (devices.length > 0) {
    await sendExpoPush(
      devices.map((d) => d.token),
      { title, body: text, data: { deepLink } }
    );
  }
}

module.exports = { dispatchNotification };
