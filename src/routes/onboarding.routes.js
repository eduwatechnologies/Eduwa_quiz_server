const express = require("express");
const { requireAuth } = require("../middleware/auth");
const userController = require("../controllers/userController");

const router = express.Router();

router.post("/complete", requireAuth, userController.completeOnboarding);

module.exports = router;
