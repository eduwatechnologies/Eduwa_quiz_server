const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const Subject = require("../models/Subject");
const Question = require("../models/Question");
const QuizSession = require("../models/QuizSession");
const QuizAttempt = require("../models/QuizAttempt");

/** Shuffles an array in place using Fisher-Yates. */
function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const startQuiz = asyncHandler(async (req, res) => {
  const { subjectId, topic, year, questionCount } = req.body;

  const subject = await Subject.findById(subjectId);
  if (!subject) throw ApiError.notFound("Subject not found");

  const filter = { subjectId, source: "past" };
  if (topic) filter.topic = topic;
  if (year) filter.year = year;

  const pool = await Question.find(filter);
  if (pool.length === 0) {
    throw ApiError.notFound("No questions available for that subject/topic/year combination");
  }

  const selected = shuffle(pool).slice(0, Math.min(questionCount, pool.length));

  const session = await QuizSession.create({
    userId: req.user._id,
    subjectId,
    subjectName: subject.name,
    topic: topic || null,
    mode: "past",
    year: year || null,
    questionIds: selected.map((q) => q._id),
    status: "in_progress",
  });

  res.status(201).json({
    id: session._id.toString(),
    subjectId,
    subjectName: subject.name,
    topic: topic || null,
    mode: "past",
    year: year || null,
    startedAt: session.startedAt,
    questions: selected.map((q) => q.toClientJSON()),
  });
});

/**
 * Shared logic for completing both "past" and "ai" mode quiz sessions.
 * Scores the submitted answers against the session's question snapshot,
 * saves an attempt to history, and marks the session completed.
 */
const completeQuiz = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { answers } = req.body;

  const session = await QuizSession.findOne({ _id: sessionId, userId: req.user._id });
  if (!session) throw ApiError.notFound("Quiz session not found");
  if (session.status === "completed") {
    throw ApiError.conflict("This quiz session has already been completed");
  }

  const questions = await Question.find({ _id: { $in: session.questionIds } });

  let score = 0;
  const review = [];
  const questionsSnapshot = [];

  for (const q of questions) {
    const qid = q._id.toString();
    const userAnswer = answers[qid] ?? null;
    const isCorrect = userAnswer === q.correctAnswer;
    if (isCorrect) score += 1;

    review.push({
      questionId: qid,
      userAnswer,
      correctAnswer: q.correctAnswer,
      isCorrect,
    });
    questionsSnapshot.push(q.toClientJSON());
  }

  const percentage = questions.length
    ? Math.round((score / questions.length) * 100)
    : 0;

  const attempt = await QuizAttempt.create({
    userId: req.user._id,
    sessionId: session._id,
    subjectId: session.subjectId,
    subjectName: session.subjectName,
    topic: session.topic,
    mode: session.mode,
    questionsSnapshot,
    answers,
    score,
    questionsCount: questions.length,
    percentage,
    review: review.filter((r) => !r.isCorrect), // spec shows only incorrect items in review
    completedAt: new Date(),
  });

  session.status = "completed";
  session.completedAt = new Date();
  await session.save();

  res.status(200).json({
    id: attempt._id.toString(),
    subjectName: attempt.subjectName,
    topic: attempt.topic,
    mode: attempt.mode,
    questions: questionsSnapshot,
    answers,
    score,
    percentage,
    completedAt: attempt.completedAt,
    review: attempt.review,
  });
});

const getResultDetail = asyncHandler(async (req, res) => {
  const attempt = await QuizAttempt.findOne({ _id: req.params.attemptId, userId: req.user._id });
  if (!attempt) throw ApiError.notFound("Result not found");

  res.status(200).json({
    id: attempt._id.toString(),
    subjectName: attempt.subjectName,
    topic: attempt.topic,
    mode: attempt.mode,
    questions: attempt.questionsSnapshot,
    answers: attempt.answers,
    score: attempt.score,
    percentage: attempt.percentage,
    completedAt: attempt.completedAt,
    review: attempt.review,
  });
});

const listResults = asyncHandler(async (req, res) => {
  const { subjectId, limit = 10, offset = 0 } = req.query;

  const filter = { userId: req.user._id };
  if (subjectId) filter.subjectId = subjectId;

  const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);
  const parsedOffset = parseInt(offset, 10) || 0;

  const [items, count] = await Promise.all([
    QuizAttempt.find(filter)
      .sort({ completedAt: -1 })
      .skip(parsedOffset)
      .limit(parsedLimit),
    QuizAttempt.countDocuments(filter),
  ]);

  res.status(200).json({
    items: items.map((a) => ({
      id: a._id.toString(),
      subjectName: a.subjectName,
      topic: a.topic,
      mode: a.mode,
      questionsCount: a.questionsCount,
      score: a.score,
      percentage: a.percentage,
      completedAt: a.completedAt,
    })),
    count,
  });
});

module.exports = { startQuiz, completeQuiz, getResultDetail, listResults };
