const express = require("express");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const questionController = require("../controllers/questionController");

const router = express.Router();

router.get("/", requireAuth, questionController.listQuestions);

// Admin CMS endpoints (per spec section 2.3)
router.post("/", requireAuth, requireAdmin, questionController.createQuestion);
router.put("/:id", requireAuth, requireAdmin, questionController.updateQuestion);
router.delete("/:id", requireAuth, requireAdmin, questionController.deleteQuestion);

module.exports = router;
