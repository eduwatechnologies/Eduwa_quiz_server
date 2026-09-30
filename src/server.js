require("dotenv").config();

const createApp = require("./app");
const { connectDB } = require("./config/db");
const { registerNotificationJobs } = require("./jobs/notificationJobs");

const PORT = process.env.PORT || 4000;

async function main() {
  await connectDB();

  const app = createApp();

  const server = app.listen(PORT, () => {
    console.log(`[server] Eduwa Quiz API listening on port ${PORT} (${process.env.NODE_ENV || "development"})`);
  });

  if (process.env.ENABLE_CRON === "true") {
    registerNotificationJobs();
  } else {
    console.log("[server] ENABLE_CRON is not 'true' — skipping notification cron jobs");
  }

  const shutdown = (signal) => {
    console.log(`[server] received ${signal}, shutting down gracefully...`);
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
