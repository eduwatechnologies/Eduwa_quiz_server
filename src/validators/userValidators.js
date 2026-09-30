const { z } = require("zod");

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  course: z.string().min(1).optional(),
  examYear: z.string().min(4).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

module.exports = { updateProfileSchema };
