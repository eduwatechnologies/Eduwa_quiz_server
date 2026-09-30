const QuizAttempt = require("../models/QuizAttempt");

/**
 * Computes the user's current daily streak (consecutive days with at least
 * one completed quiz attempt, counting back from today) and longest streak.
 */
async function computeStreaks(userId) {
  const attempts = await QuizAttempt.find({ userId })
    .select("completedAt")
    .sort({ completedAt: -1 })
    .lean();

  if (attempts.length === 0) {
    return { currentStreakDays: 0, longestStreakDays: 0 };
  }

  const dayKeys = [
    ...new Set(
      attempts.map((a) => new Date(a.completedAt).toISOString().slice(0, 10))
    ),
  ].sort((a, b) => (a < b ? 1 : -1)); // descending, most recent first

  const oneDay = 24 * 60 * 60 * 1000;
  const toDate = (key) => new Date(`${key}T00:00:00.000Z`);

  // Current streak: walk back from today/yesterday
  let currentStreakDays = 0;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  let cursor = today;

  for (const key of dayKeys) {
    const day = toDate(key);
    const diff = Math.round((cursor - day) / oneDay);
    if (diff === 0 || diff === 1) {
      currentStreakDays += 1;
      cursor = day;
    } else if (diff > 1) {
      break;
    }
  }
  // If the most recent activity isn't today or yesterday, streak is 0.
  const mostRecentDiff = Math.round((today - toDate(dayKeys[0])) / oneDay);
  if (mostRecentDiff > 1) currentStreakDays = 0;

  // Longest streak: scan all days in ascending order
  const ascending = [...dayKeys].sort();
  let longestStreakDays = 1;
  let running = 1;
  for (let i = 1; i < ascending.length; i++) {
    const diff = Math.round((toDate(ascending[i]) - toDate(ascending[i - 1])) / oneDay);
    if (diff === 1) {
      running += 1;
    } else {
      running = 1;
    }
    longestStreakDays = Math.max(longestStreakDays, running);
  }

  return { currentStreakDays, longestStreakDays };
}

/**
 * Aggregates the headline stats shown on the user profile and home screen.
 */
async function computeUserStats(userId) {
  const attempts = await QuizAttempt.find({ userId }).lean();

  const questionsAnswered = attempts.reduce((sum, a) => sum + (a.questionsCount || 0), 0);
  const averageScore = attempts.length
    ? Math.round(
        attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length
      )
    : 0;
  const sessionsCompleted = attempts.length;

  const { currentStreakDays } = await computeStreaks(userId);

  return {
    questionsAnswered,
    averageScore,
    currentStreak: currentStreakDays,
    sessionsCompleted,
  };
}

module.exports = { computeStreaks, computeUserStats };
