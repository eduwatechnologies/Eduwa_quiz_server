const express = require("express");
const multer = require("multer");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { generateAiQuizSchema } = require("../validators/quizValidators");
const { startCoachSessionSchema, coachMessageSchema } = require("../validators/coachValidators");
const aiQuizController = require("../controllers/aiQuizController");
const coachController = require("../controllers/coachController");

const upload = multer(); // in-memory storage; used for audio blob uploads to the coach

const router = express.Router();

router.use(requireAuth);

// Access to the AI features is paid for with tokens, not a subscription.
// The token balance check lives in each controller so the 402 message can
// name the exact cost and the user's remaining balance.

// Smart Practice (AI-generated quizzes)
router.post(
  "/quizzes/generate",
  validate(generateAiQuizSchema),
  aiQuizController.generateAiQuiz
);

// Voice Study Coach
router.post(
  "/coach/session",
  validate(startCoachSessionSchema),
  coachController.startCoachSession
);
router.get("/coach/suggestions", coachController.getCoachSuggestions);

// Accepts either JSON { text } or multipart/form-data with an "audio" file.
// multer.any() lets either shape through; sendCoachMessage currently expects
// req.body.text — wire in a Whisper/Gemini transcription step in
// coachController for the audio-blob case before calling generateCoachReply.
router.post(
  "/coach/:sessionId/message",
  upload.single("audio"),
  validate(coachMessageSchema),
  coachController.sendCoachMessage
);

module.exports = router;
