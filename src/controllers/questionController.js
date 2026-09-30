const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const Question = require("../models/Question");

const listQuestions = asyncHandler(async (req, res) => {
  const { subjectId, topic, year, limit = 50, offset = 0 } = req.query;

  if (!subjectId) throw ApiError.badRequest("subjectId is required");

  const filter = { subjectId, source: "past" };
  if (topic) filter.topic = topic;
  if (year) filter.year = parseInt(year, 10);

  const parsedLimit = Math.min(parseInt(limit, 10) || 50, 200);
  const parsedOffset = parseInt(offset, 10) || 0;

  const [items, count] = await Promise.all([
    Question.find(filter).skip(parsedOffset).limit(parsedLimit).sort({ createdAt: -1 }),
    Question.countDocuments(filter),
  ]);

  res.status(200).json({
    items: items.map((q) => q.toClientJSON()),
    count,
  });
});

// --- Admin CMS ---

/**
 * Admin question browser — unlike the public listQuestions (which is
 * scoped to source:"past" only), this exposes both past and AI-generated
 * questions and doesn't require subjectId, for CMS/moderation use.
 */
const adminListQuestions = asyncHandler(async (req, res) => {
  const { subjectId, topic, year, source, limit = 50, offset = 0 } = req.query;

  const filter = {};
  if (subjectId) filter.subjectId = subjectId;
  if (topic) filter.topic = topic;
  if (year) filter.year = parseInt(year, 10);
  if (source) filter.source = source;

  const parsedLimit = Math.min(parseInt(limit, 10) || 50, 200);
  const parsedOffset = parseInt(offset, 10) || 0;

  const [items, count] = await Promise.all([
    Question.find(filter).skip(parsedOffset).limit(parsedLimit).sort({ createdAt: -1 }),
    Question.countDocuments(filter),
  ]);

  res.status(200).json({
    items: items.map((q) => q.toClientJSON()),
    count,
  });
});

const createQuestion = asyncHandler(async (req, res) => {
  const question = await Question.create({ ...req.body, source: "past" });
  res.status(201).json(question.toClientJSON());
});

const updateQuestion = asyncHandler(async (req, res) => {
  const question = await Question.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!question) throw ApiError.notFound("Question not found");
  res.status(200).json(question.toClientJSON());
});

const deleteQuestion = asyncHandler(async (req, res) => {
  const question = await Question.findByIdAndDelete(req.params.id);
  if (!question) throw ApiError.notFound("Question not found");
  res.status(204).send();
});

/**
 * Bulk import expects a JSON body: { questions: [ {subjectId, topic, year,
 * text, options, correctAnswer, explanation, difficulty}, ... ] }
 * For CSV/XLSX uploads, parse the file client-side or add multer + a CSV
 * parser (e.g. `papaparse`/`csv-parse`) upstream of this handler.
 */
const bulkImportQuestions = asyncHandler(async (req, res) => {
  const { questions } = req.body;
  if (!Array.isArray(questions) || questions.length === 0) {
    throw ApiError.badRequest("questions[] is required");
  }

  const docs = questions.map((q) => ({ ...q, source: "past" }));
  const inserted = await Question.insertMany(docs, { ordered: false });

  res.status(201).json({ inserted: inserted.length });
});

module.exports = {
  listQuestions,
  adminListQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  bulkImportQuestions,
};
