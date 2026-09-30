const { z } = require("zod");

const notificationPrefsSchema = z.object({
  dailyReminder: z.boolean().optional(),
  streakAlerts: z.boolean().optional(),
  weeklySummary: z.boolean().optional(),
  examCountdown: z.boolean().optional(),
  reminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "reminderTime must be HH:mm (24h)")
    .optional(),
  timezone: z.string().min(1).optional(),
  pushDeviceTokens: z
    .array(
      z.object({
        token: z.string().min(1),
        platform: z.enum(["android", "ios"]),
      })
    )
    .optional(),
});

module.exports = { notificationPrefsSchema };
