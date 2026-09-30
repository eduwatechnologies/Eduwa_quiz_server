const asyncHandler = require("../utils/asyncHandler");
const QuizAttempt = require("../models/QuizAttempt");
const Question = require("../models/Question");
const Subject = require("../models/Subject");
const { computeUserStats, computeStreaks } = require("../services/statsService");

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function computeWeeklyPerformance(userId) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);

  const attempts = await QuizAttempt.find({
    userId,
    completedAt: { $gte: sevenDaysAgo },
  }).lean();

  // Build a map for the last 7 days (oldest -> newest)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ key, label: DAY_LABELS[d.getUTCDay()], correct: 0, total: 0 });
  }
  const byKey = Object.fromEntries(days.map((d) => [d.key, d]));

  for (const attempt of attempts) {
    const key = new Date(attempt.completedAt).toISOString().slice(0, 10);
    if (byKey[key]) {
      byKey[key].correct += attempt.score;
      byKey[key].total += attempt.questionsCount;
    }
  }

  return days.map((d) => ({ day: d.label, correct: d.correct, total: d.total }));
}

async function computeBySubject(userId) {
  const subjects = await Subject.find().lean();

  const bySubject = await Promise.all(
    subjects.map(async (subject) => {
      const attempts = await QuizAttempt.find({ userId, subjectId: subject._id }).lean();
      const questionsAnswered = attempts.reduce((s, a) => s + a.questionsCount, 0);
      const accuracy = attempts.length
        ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length)
        : 0;
      const total = await Question.countDocuments({ subjectId: subject._id, source: "past" });

      const answeredIds = new Set();
      for (const a of attempts) {
        for (const item of a.review || []) {
          if (item.isCorrect) answeredIds.add(item.questionId);
        }
      }

      return {
        subjectId: subject._id,
        subjectName: subject.name,
        accuracy,
        questionsAnswered,
        completed: Math.min(answeredIds.size, total),
        total,
      };
    })
  );

  return bySubject;
}

async function computeWeakestTopics(userId, limit = 5) {
  const results = await QuizAttempt.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: { subjectId: "$subjectId", topic: "$topic" },
        accuracy: { $avg: "$percentage" },
        attempts: { $sum: 1 },
      },
    },
    { $match: { "_id.topic": { $ne: null } } },
    { $sort: { accuracy: 1 } },
    { $limit: limit },
  ]);

  return results.map((r) => ({
    subjectId: r._id.subjectId,
    topic: r._id.topic,
    accuracy: Math.round(r.accuracy),
  }));
}

const getProgressSummary = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [stats, streaks, weeklyPerformance, bySubject, weakestTopics] = await Promise.all([
    computeUserStats(userId),
    computeStreaks(userId),
    computeWeeklyPerformance(userId),
    computeBySubject(userId),
    computeWeakestTopics(userId),
  ]);

  const nextFocus = weakestTopics[0]
    ? {
        subjectId: weakestTopics[0].subjectId,
        reason: "Has the most room to grow.",
      }
    : null;

  res.status(200).json({
    overview: {
      questionsAnswered: stats.questionsAnswered,
      accuracy: stats.averageScore,
      sessionsCompleted: stats.sessionsCompleted,
      currentStreakDays: streaks.currentStreakDays,
      longestStreakDays: streaks.longestStreakDays,
    },
    weeklyPerformance,
    bySubject,
    weakestTopics,
    nextFocusSuggestion: nextFocus,
  });
});

const getSubjectProgress = asyncHandler(async (req, res) => {
  const bySubject = await computeBySubject(req.user._id);
  res.status(200).json(bySubject);
});

module.exports = { getProgressSummary, getSubjectProgress };
