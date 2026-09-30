const asyncHandler = require("../utils/asyncHandler");
const AdCampaign = require("../models/AdCampaign");
const { getOrCreateSettings } = require("./settingsController");

const getAdBanner = asyncHandler(async (req, res) => {
  const { placement = "home" } = req.query;

  const settings = await getOrCreateSettings(req.user._id);

  if (!settings.sponsoredContent) {
    return res.status(200).json({ skip: true });
  }

  const candidates = await AdCampaign.find({ placement, active: true });
  if (candidates.length === 0) {
    return res.status(200).json({ skip: true });
  }

  // Simple weighted random pick
  const totalWeight = candidates.reduce((s, c) => s + (c.weight || 1), 0);
  let r = Math.random() * totalWeight;
  let chosen = candidates[0];
  for (const c of candidates) {
    r -= c.weight || 1;
    if (r <= 0) {
      chosen = c;
      break;
    }
  }

  res.status(200).json({
    skip: false,
    id: chosen._id.toString(),
    title: chosen.title,
    subtitle: chosen.subtitle,
    cta: chosen.cta,
    url: chosen.url,
    imageUrl: chosen.imageUrl,
  });
});

module.exports = { getAdBanner };
