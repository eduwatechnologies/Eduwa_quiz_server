const express = require("express");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { startQuizSchema, completeQuizSchema } = require("../validators/quizValidators");
const quizController = require("../controllers/quizController");

const router = express.Router();

router.use(requireAuth);

router.post("/start", validate(startQuizSchema), quizController.startQuiz);
router.post("/:sessionId/complete", validate(completeQuizSchema), quizController.completeQuiz);

module.exports = router;
