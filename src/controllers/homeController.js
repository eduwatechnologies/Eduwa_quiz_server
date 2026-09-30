const asyncHandler = require("../utils/asyncHandler");
const QuizSession = require("../models/QuizSession");
const Subject = require("../models/Subject");
const { computeUserStats, computeStreaks } = require("../services/statsService");
const { getOrCreateSettings } = require("./settingsController");

function greetingForHour(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const getHome = asyncHandler(async (req, res) => {
  const user = req.user;
  const [stats, streaks, settings] = await Promise.all([
    computeUserStats(user._id),
    computeStreaks(user._id),
    getOrCreateSettings(user._id),
  ]);

  // Most recent unfinished session, used for the "continue where you left
  // off" hero card.
  const inProgress = await QuizSession.findOne({
    userId: user._id,
    status: "in_progress",
  }).sort({ startedAt: -1 });

  let heroContinueSubject = null;
  if (inProgress) {
    const subject = await Subject.findById(inProgress.subjectId).lean();
    const totalQuestions = inProgress.questionIds.length;
    // Without a partial-answers store, we approximate progress as "not yet
    // submitted" (0 of N); wire this up to a live answers draft if the
    // client persists in-progress answers server-side.
    heroContinueSubject = {
      id: inProgress.subjectId,
      topic: inProgress.topic,
      ofTotal: `0 of ${totalQuestions} questions`,
      progress: 0,
    };
    void subject; // available if the client wants subject name here too
  }

  const now = new Date();
  // Daily goal progress: quiz attempts' questionsCount completed today,
  // capped by the user's daily goal target.
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);

  const QuizAttempt = require("../models/QuizAttempt");
  const todaysAttempts = await QuizAttempt.find({
    userId: user._id,
    completedAt: { $gte: startOfToday },
  }).lean();
  const completedToday = todaysAttempts.reduce((s, a) => s + a.questionsCount, 0);

  res.status(200).json({
    greeting: greetingForHour(now.getHours()),
    examPlan: `JAMB ${user.examYear} · CBT preparation`,
    streak: streaks.currentStreakDays,
    heroContinueSubject,
    stats: {
      questionsDone: stats.questionsAnswered,
      averageScore: `${stats.averageScore}%`,
      streak: `${streaks.currentStreakDays} days`,
    },
    smartPracticePromo: {
      ctaText: "Practice smarter with AI",
      subText: "Personalized questions for any topic",
    },
    dailyGoalProgress: {
      target: settings.dailyGoal,
      completed: Math.min(completedToday, settings.dailyGoal),
    },
  });
});

module.exports = { getHome };
