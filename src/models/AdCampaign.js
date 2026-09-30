const mongoose = require("mongoose");

const adCampaignSchema = new mongoose.Schema(
  {
    placement: { type: String, required: true, index: true }, // e.g. "home"
    title: { type: String, required: true, default: "Sponsored" },
    subtitle: { type: String, required: true },
    cta: { type: String, default: "Learn more" },
    url: { type: String, required: true },
    imageUrl: { type: String, default: null },
    active: { type: Boolean, default: true },
    weight: { type: Number, default: 1 }, // for weighted random selection
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdCampaign", adCampaignSchema);
