/**
 * Push notification service — sends via Expo Push Notifications, which then
 * fans out to FCM (Android) / APNs (iOS). Simplest option for Expo apps
 * per the recommended stack.
 */

async function sendExpoPush(tokens, { title, body, data = {} }) {
  if (!tokens || tokens.length === 0) return { sent: 0 };

  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data,
  }));

  if (!process.env.EXPO_ACCESS_TOKEN) {
    console.log(`[push:mock] would send to ${tokens.length} device(s): "${title}" — ${body}`);
    return { sent: tokens.length, mock: true };
  }

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(messages),
  });
  const result = await res.json();
  return { sent: tokens.length, result };
}

module.exports = { sendExpoPush };
