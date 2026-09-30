const { z } = require("zod");

const startCoachSessionSchema = z.object({
  voiceProfileId: z.string().default("juniper-default"),
});

// `text` is optional at the schema level because an audio-only
// multipart/form-data request (voice message) won't have a text field —
// the controller requires either req.body.text or req.file to be present.
const coachMessageSchema = z.object({
  text: z.string().min(1).optional(),
});

module.exports = { startCoachSessionSchema, coachMessageSchema };
