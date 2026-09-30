const cron = require("node-cron");

const NotificationPreference = require("../models/NotificationPreference");
const User = require("../models/User");
const QuizAttempt = require("../models/QuizAttempt");
const { dispatchNotification } = require("../services/notificationDispatchService");
const { computeUserStats } = require("../services/statsService");

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

/** Returns "HH:mm" (24h) for `date` as observed in IANA timezone `tz`. */
function localHHmm(tz, date = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch (err) {
    // Invalid/unknown timezone string — fall back to UTC rather than crash.
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }
}

/** Returns "yyyy-mm-dd" for `date` as observed in IANA timezone `tz`. */
function localDateKey(tz, date = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(date); // en-CA => yyyy-mm-dd
  } catch (err) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(date);
  }
}

/**
 * Daily practice reminder — fires once per user, at their configured
 * reminderTime (default 08:00) in their configured timezone (default
 * Africa/Lagos). Runs every minute and matches on local HH:mm, deduped by
 * lastDailyReminderSentOn so a user with dailyReminder enabled only gets
 * one per calendar day. (Spec 9.5: "Daily practice reminders — time set by
 * user or default 8:00 AM local".)
 */
async function runDailyReminderJob(now = new Date()) {
  const prefs = await NotificationPreference.find({ dailyReminder: true });

  for (const pref of prefs) {
    const nowHHmm = localHHmm(pref.timezone, now);
    if (nowHHmm !== pref.reminderTime) continue;

    const today = localDateKey(pref.timezone, now);
    if (pref.lastDailyReminderSentOn === today) continue;

    await dispatchNotification(pref.userId, {
      icon: "sun",
      colorKey: "primary",
      title: "Your daily practice is ready",
      text: "Keep your JAMB preparation moving with 10 questions.",
      deepLink: "/practice",
    });

    pref.lastDailyReminderSentOn = today;
    await pref.save();
  }
}

/**
 * Streak-protection alert — fires once per "at risk" gap when a user with
 * streakAlerts enabled hasn't practised in 18+ hours, so they can act before
 * losing their streak. (Spec 9.5: "Streak-alert push ... not practised in
 * 18+ hours".)
 */
async function runStreakAlertJob(now = new Date()) {
  const prefs = await NotificationPreference.find({ streakAlerts: true });

  for (const pref of prefs) {
    const lastAttempt = await QuizAttempt.findOne({ userId: pref.userId })
      .sort({ completedAt: -1 })
      .select("completedAt");

    if (!lastAttempt) continue; // no streak yet to protect

    const hoursSince = (now - lastAttempt.completedAt) / ONE_HOUR_MS;
    if (hoursSince < 18) continue;

    // Dedupe: only one alert per gap — skip if we already alerted for
    // inactivity since this same last-attempt timestamp.
    if (pref.lastStreakAlertAt && pref.lastStreakAlertAt > lastAttempt.completedAt) continue;

    await dispatchNotification(pref.userId, {
      // Icon/color values are rendered by the client with Feather icons and
      // the app's color tokens, so both must match the client's vocabulary.
      icon: "zap",
      colorKey: "orange",
      title: "Your streak is at risk",
      text: "You haven't practised in a while — a quick session keeps your streak alive.",
      deepLink: "/practice",
    });

    pref.lastStreakAlertAt = now;
    await pref.save();
  }
}

/**
 * Weekly summary — every Monday at 09:00 server time, for users with
 * weeklySummary enabled. (Spec 9.5: "Weekly summary (every Monday 9:00 AM)
 * if enabled.") Runs on a server-time cron schedule rather than per-user
 * local time, since the spec pins it to a single fixed slot.
 */
async function runWeeklySummaryJob() {
  const prefs = await NotificationPreference.find({ weeklySummary: true });

  for (const pref of prefs) {
    const stats = await computeUserStats(pref.userId);
    if (stats.sessionsCompleted === 0) continue; // nothing to summarize

    await dispatchNotification(pref.userId, {
      icon: "bar-chart-2",
      colorKey: "primary",
      title: "Your weekly summary is in",
      text: `You answered ${stats.questionsAnswered} questions averaging ${stats.averageScore}% this period. Keep going!`,
      deepLink: "/progress",
    });
  }
}

/**
 * Exam countdown alerts — fires once each at 30, 7, and 1 day(s) before
 * JAMB_EXAM_DATE for users with examCountdown enabled. (Spec 9.5: "Exam
 * countdown alerts (configurable: 30 days, 7 days, 1 day before)".)
 */
const COUNTDOWN_THRESHOLDS = [30, 7, 1];

async function runExamCountdownJob(now = new Date()) {
  const examDateStr = process.env.JAMB_EXAM_DATE;
  if (!examDateStr) return; // not configured — skip silently

  const examDate = new Date(`${examDateStr}T00:00:00.000Z`);
  const daysRemaining = Math.ceil((examDate - now) / ONE_DAY_MS);

  if (!COUNTDOWN_THRESHOLDS.includes(daysRemaining)) return;

  const prefs = await NotificationPreference.find({
    examCountdown: true,
    lastExamCountdownDaysSent: { $ne: daysRemaining },
  });

  for (const pref of prefs) {
    await dispatchNotification(pref.userId, {
      icon: "calendar",
      colorKey: "red",
      title: `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} until JAMB`,
      text:
        daysRemaining === 1
          ? "Exam day is tomorrow — review your weakest topics and get a good night's sleep."
          : `${daysRemaining} days left. A focused review plan now goes a long way.`,
      deepLink: "/progress",
    });

    pref.lastExamCountdownDaysSent = daysRemaining;
    await pref.save();
  }
}

/**
 * Registers all four cron schedules. Call once at server startup when
 * ENABLE_CRON=true. Safe to call in a single-instance deployment; for
 * multi-instance deployments, guard this behind a leader-election check or
 * move it to a dedicated worker process so jobs don't run N times.
 */
function registerNotificationJobs() {
  // Every minute — checks each user's local reminder time.
  cron.schedule("* * * * *", () => {
    runDailyReminderJob().catch((err) => console.error("[jobs] daily reminder failed:", err));
  });

  // Every hour, on the hour.
  cron.schedule("0 * * * *", () => {
    runStreakAlertJob().catch((err) => console.error("[jobs] streak alert failed:", err));
  });

  // Every Monday at 09:00 server time.
  cron.schedule("0 9 * * 1", () => {
    runWeeklySummaryJob().catch((err) => console.error("[jobs] weekly summary failed:", err));
  });

  // Once a day at 07:00 server time.
  cron.schedule("0 7 * * *", () => {
    runExamCountdownJob().catch((err) => console.error("[jobs] exam countdown failed:", err));
  });

  console.log("[jobs] notification cron jobs registered");
}

module.exports = {
  registerNotificationJobs,
  runDailyReminderJob,
  runStreakAlertJob,
  runWeeklySummaryJob,
  runExamCountdownJob,
};
