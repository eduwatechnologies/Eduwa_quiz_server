const { z } = require("zod");

const updateSettingsSchema = z.object({
  soundEffects: z.boolean().optional(),
  haptics: z.boolean().optional(),
  sponsoredContent: z.boolean().optional(),
  reducedMotion: z.boolean().optional(),
  dailyGoal: z.union([z.literal(10), z.literal(20), z.literal(30)]).optional(),
  // appVersion / contentVersion are server-only and intentionally not
  // accepted here even if the client sends them (per spec section 10.2).
});

module.exports = { updateSettingsSchema };
