const express = require("express");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const subjectController = require("../controllers/subjectController");

const router = express.Router();

router.get("/", requireAuth, subjectController.listSubjects);
router.get("/:subjectId", requireAuth, subjectController.getSubjectDetail);

module.exports = router;
