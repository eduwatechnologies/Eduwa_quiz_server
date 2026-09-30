const express = require("express");

const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const onboardingRoutes = require("./onboarding.routes");
const subjectRoutes = require("./subject.routes");
const questionRoutes = require("./question.routes");
const quizRoutes = require("./quiz.routes");
const resultsRoutes = require("./results.routes");
const aiRoutes = require("./ai.routes");
const tokenRoutes = require("./token.routes");
const progressRoutes = require("./progress.routes");
const notificationRoutes = require("./notification.routes");
const homeRoutes = require("./home.routes");
const adRoutes = require("./ad.routes");
const adminRoutes = require("./admin.routes"); // mounts its own /auth/admin/signin + /admin/* paths

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/onboarding", onboardingRoutes);
router.use("/subjects", subjectRoutes);
router.use("/questions", questionRoutes);
router.use("/quizzes", quizRoutes);
router.use("/results", resultsRoutes);
router.use("/ai", aiRoutes);
router.use("/tokens", tokenRoutes);
router.use("/progress", progressRoutes);
router.use("/notifications", notificationRoutes);
router.use("/home", homeRoutes);
router.use("/ads", adRoutes);
router.use("/", adminRoutes); // exposes /auth/admin/signin and /admin/*

module.exports = router;
