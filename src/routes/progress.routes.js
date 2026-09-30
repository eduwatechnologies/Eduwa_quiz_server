const express = require("express");
const { requireAuth } = require("../middleware/auth");
const progressController = require("../controllers/progressController");

const router = express.Router();

router.use(requireAuth);

router.get("/summary", progressController.getProgressSummary);
router.get("/subjects", progressController.getSubjectProgress);

module.exports = router;
