const asyncHandler = require("../utils/asyncHandler");
const UserSettings = require("../models/UserSettings");

const CONTENT_VERSION = "2026.01";
const APP_VERSION = "0.0.0"; // bump via deployment config, not client input

async function getOrCreateSettings(userId) {
  let settings = await UserSettings.findOne({ userId });
  if (!settings) {
    settings = await UserSettings.create({ userId, appVersion: APP_VERSION, contentVersion: CONTENT_VERSION });
  }
  return settings;
}

function toResponse(settings) {
  return {
    soundEffects: settings.soundEffects,
    haptics: settings.haptics,
    sponsoredContent: settings.sponsoredContent,
    reducedMotion: settings.reducedMotion,
    dailyGoal: settings.dailyGoal,
    appVersion: APP_VERSION,
    contentVersion: CONTENT_VERSION,
  };
}

const getSettings = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings(req.user._id);
  res.status(200).json(toResponse(settings));
});

const updateSettings = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings(req.user._id);
  Object.assign(settings, req.body); // appVersion/contentVersion never in req.body (stripped by validator)
  await settings.save();
  res.status(200).json(toResponse(settings));
});

module.exports = { getSettings, updateSettings, getOrCreateSettings };
