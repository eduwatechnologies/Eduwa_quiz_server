const { z } = require("zod");

const startQuizSchema = z.object({
  subjectId: z.string().min(1),
  topic: z.string().optional(),
  mode: z.literal("past").default("past"),
  year: z.number().int().optional(),
  questionCount: z.number().int().min(1).max(50).default(10),
});

const completeQuizSchema = z.object({
  answers: z.record(z.string(), z.string()),
});

const generateAiQuizSchema = z.object({
  subjectId: z.string().min(1),
  topic: z.string().min(1),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).default("Medium"),
  questionCount: z.number().int().min(1).max(20).default(5),
});

module.exports = { startQuizSchema, completeQuizSchema, generateAiQuizSchema };
