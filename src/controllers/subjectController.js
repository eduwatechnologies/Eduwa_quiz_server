const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const Subject = require("../models/Subject");
const Question = require("../models/Question");
const QuizAttempt = require("../models/QuizAttempt");

/**
 * Computes "completed / total" progress for a subject for a given user:
 * total = number of past-question bank items for that subject;
 * completed = number of distinct questions the user has ever answered
 * correctly (approximated here via distinct questionIds seen across their
 * completed attempts for that subject).
 */
async function computeSubjectProgress(userId, subjectId) {
  const total = await Question.countDocuments({ subjectId, source: "past" });

  const attempts = await QuizAttempt.find({ userId, subjectId }).select("review").lean();
  const answeredIds = new Set();
  for (const attempt of attempts) {
    for (const item of attempt.review || []) {
      if (item.isCorrect) answeredIds.add(item.questionId);
    }
  }

  return { completed: Math.min(answeredIds.size, total), total };
}

const listSubjects = asyncHandler(async (req, res) => {
  const subjects = await Subject.find().sort({ name: 1 }).lean();

  const withProgress = await Promise.all(
    subjects.map(async (s) => ({
      id: s._id,
      name: s.name,
      shortName: s.shortName,
      icon: s.icon,
      color: s.color,
      topics: s.topics,
      progress: await computeSubjectProgress(req.user._id, s._id),
    }))
  );

  res.status(200).json(withProgress);
});

const getSubjectDetail = asyncHandler(async (req, res) => {
  const subject = await Subject.findById(req.params.subjectId).lean();
  if (!subject) throw ApiError.notFound("Subject not found");

  const years = await Question.distinct("year", {
    subjectId: subject._id,
    source: "past",
    year: { $ne: null },
  });

  const progress = await computeSubjectProgress(req.user._id, subject._id);

  res.status(200).json({
    id: subject._id,
    name: subject.name,
    shortName: subject.shortName,
    icon: subject.icon,
    color: subject.color,
    topics: subject.topics,
    progress,
    availableYears: years.sort((a, b) => b - a),
  });
});

// --- Admin CMS ---

const adminListSubjects = asyncHandler(async (req, res) => {
  const subjects = await Subject.find().sort({ name: 1 });
  res.status(200).json(subjects);
});

const adminUpsertSubject = asyncHandler(async (req, res) => {
  const { id, name, shortName, icon, color, topics } = req.body;
  if (!id || !name) throw ApiError.badRequest("id and name are required");

  const subject = await Subject.findByIdAndUpdate(
    id,
    { _id: id, name, shortName: shortName || name, icon, color, topics: topics || [] },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(200).json(subject);
});

const adminDeleteSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findByIdAndDelete(req.params.subjectId);
  if (!subject) throw ApiError.notFound("Subject not found");
  res.status(204).send();
});

module.exports = {
  listSubjects,
  getSubjectDetail,
  adminListSubjects,
  adminUpsertSubject,
  adminDeleteSubject,
};
