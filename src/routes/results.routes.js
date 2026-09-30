const express = require("express");
const { requireAuth } = require("../middleware/auth");
const quizController = require("../controllers/quizController");

const router = express.Router();

router.use(requireAuth);

router.get("/", quizController.listResults);
router.get("/:attemptId", quizController.getResultDetail);

module.exports = router;
