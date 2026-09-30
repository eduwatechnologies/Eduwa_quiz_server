const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const CoachSession = require("../models/CoachSession");
const QuizAttempt = require("../models/QuizAttempt");
const { generateCoachReply, synthesizeSpeech, transcribeAudio } = require("../services/aiService");
const { debitTokens, getOrCreateWallet } = require("../services/walletService");
const { computeUserStats } = require("../services/statsService");
const { COACH_MESSAGE_TOKEN_COST } = require("../config/tokenCosts");

const startCoachSession = asyncHandler(async (req, res) => {
  const cost = COACH_MESSAGE_TOKEN_COST();
  const wallet = await getOrCreateWallet(req.user._id);
  const remaining = wallet.totalTokens - wallet.usedTokens;

  if (remaining < cost) {
    throw ApiError.paymentRequired(
      `The Voice Coach requires at least ${cost} tokens per message; you have ${remaining}.`
    );
  }

  const session = await CoachSession.create({
    userId: req.user._id,
    voiceProfileId: req.body.voiceProfileId || "juniper-default",
  });

  res.status(201).json({
    sessionId: session._id.toString(),
    tokenCostPerInteraction: cost,
    available: true,
  });
});

/**
 * Builds a compact summary of the user's real history/scores/subjects for
 * the LLM system prompt, per spec 5.2 ("real history, scores, subjects,
 * and progress").
 */
async function buildCoachContext(user) {
  const stats = await computeUserStats(user._id);

  const bySubject = await QuizAttempt.aggregate([
    { $match: { userId: user._id } },
    {
      $group: {
        _id: "$subjectName",
        avgPercentage: { $avg: "$percentage" },
        attempts: { $sum: 1 },
      },
    },
    { $sort: { avgPercentage: 1 } },
  ]);

  return {
    name: user.name,
    course: user.course,
    examYear: user.examYear,
    averageScore: stats.averageScore,
    questionsAnswered: stats.questionsAnswered,
    currentStreak: stats.currentStreak,
    weakestSubject: bySubject[0]?._id || null,
    bySubject,
  };
}

const sendCoachMessage = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { text } = req.body;
  const cost = COACH_MESSAGE_TOKEN_COST();

  const session = await CoachSession.findOne({ _id: sessionId, userId: req.user._id });
  if (!session) throw ApiError.notFound("Coach session not found");

  let message = text;
  if (!message && req.file) {
    try {
      message = await transcribeAudio(req.file);
    } catch (err) {
      throw ApiError.badRequest(`Could not transcribe audio: ${err.message}`);
    }
  }
  if (!message) {
    throw ApiError.badRequest("Either `text` or an `audio` file is required");
  }

  // Check the balance before calling the AI. Debiting afterwards would let a
  // user with an empty wallet consume a generation and only then get a 402.
  const wallet = await getOrCreateWallet(req.user._id);
  const remaining = wallet.totalTokens - wallet.usedTokens;
  if (remaining < cost) {
    throw ApiError.paymentRequired(
      `The Voice Coach requires ${cost} tokens per message; you have ${remaining}. Please purchase more tokens.`
    );
  }

  const userContext = await buildCoachContext(req.user);
  const { replyText, suggestions } = await generateCoachReply({ message, userContext });
  const replyAudioUrl = await synthesizeSpeech(replyText);

  const debitedWallet = await debitTokens(req.user._id, cost, "Coach session");

  session.messages.push({ role: "user", text: message });
  session.messages.push({ role: "coach", text: replyText, tokensUsed: cost });
  await session.save();

  res.status(200).json({
    transcribedText: text ? undefined : message, // only present for audio-input requests
    replyText,
    replyAudioUrl,
    tokensUsed: cost,
    remainingTokens: debitedWallet.totalTokens - debitedWallet.usedTokens,
    suggestions:
      suggestions && suggestions.length
        ? suggestions
        : ["Review my weakest topics", "Suggest a study plan for this week"],
  });
});

const getCoachSuggestions = asyncHandler(async (req, res) => {
  res.status(200).json([
    {
      icon: "trending-up",
      label: "Performance",
      samplePrompt: "How can I improve my average score?",
    },
    {
      icon: "map",
      label: "Private tour",
      samplePrompt: "Give me a private tour of my study plan.",
    },
    {
      icon: "target",
      label: "Weak spots",
      samplePrompt: "What topics should I focus on this week?",
    },
    {
      icon: "calendar",
      label: "Exam countdown",
      samplePrompt: "How should I plan my remaining days before JAMB?",
    },
  ]);
});

module.exports = { startCoachSession, sendCoachMessage, getCoachSuggestions };
