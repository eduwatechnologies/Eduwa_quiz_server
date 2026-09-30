const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const Subject = require("../models/Subject");
const Question = require("../models/Question");
const QuizSession = require("../models/QuizSession");
const { generateQuizQuestions } = require("../services/aiService");
const { debitTokens, getOrCreateWallet } = require("../services/walletService");
const { AI_QUIZ_TOKEN_COST } = require("../config/tokenCosts");

const generateAiQuiz = asyncHandler(async (req, res) => {
  const { subjectId, topic, difficulty, questionCount } = req.body;
  const cost = AI_QUIZ_TOKEN_COST();

  // Tokens are the only gate for this feature. Checked before generation so
  // the user is not charged for questions they never receive.
  const wallet = await getOrCreateWallet(req.user._id);
  const remaining = wallet.totalTokens - wallet.usedTokens;
  if (remaining < cost) {
    throw ApiError.paymentRequired(
      `Smart Practice requires ${cost} tokens; you have ${remaining}. Please purchase more tokens.`
    );
  }

  const subject = await Subject.findById(subjectId);
  if (!subject) throw ApiError.notFound("Subject not found");

  const generated = await generateQuizQuestions({
    subjectId,
    subjectName: subject.name,
    topic,
    difficulty,
    questionCount,
  });

  const saved = await Question.insertMany(
    generated.map((q) => ({
      subjectId,
      topic,
      year: null,
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      difficulty,
      source: "generated",
      generatedForUserId: req.user._id,
    }))
  );

  // Deduct tokens only after successful generation.
  await debitTokens(req.user._id, cost, "Smart Practice quiz");

  const session = await QuizSession.create({
    userId: req.user._id,
    subjectId,
    subjectName: subject.name,
    topic,
    mode: "ai",
    year: null,
    questionIds: saved.map((q) => q._id),
    status: "in_progress",
  });

  res.status(201).json({
    id: session._id.toString(),
    mode: "ai",
    questions: saved.map((q) => q.toClientJSON()),
  });
});

module.exports = { generateAiQuiz };
