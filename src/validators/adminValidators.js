const { z } = require("zod");

const adminSigninSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refundTokensSchema = z.object({
  amount: z.number().int().positive(),
  reason: z.string().min(1).default("Admin refund"),
});

const banUserSchema = z.object({
  banned: z.boolean(),
});

const adCampaignSchema = z.object({
  placement: z.string().min(1),
  title: z.string().min(1).default("Sponsored"),
  subtitle: z.string().min(1),
  cta: z.string().default("Learn more"),
  url: z.string().url(),
  imageUrl: z.string().url().nullable().optional(),
  active: z.boolean().default(true),
  weight: z.number().positive().default(1),
});

const updateAdCampaignSchema = adCampaignSchema.partial();

module.exports = {
  adminSigninSchema,
  refundTokensSchema,
  banUserSchema,
  adCampaignSchema,
  updateAdCampaignSchema,
};
