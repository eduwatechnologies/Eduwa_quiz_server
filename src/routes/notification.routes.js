const express = require("express");
const { requireAuth } = require("../middleware/auth");
const notificationController = require("../controllers/notificationController");

const router = express.Router();

router.use(requireAuth);

router.get("/", notificationController.listNotifications);
router.post("/mark-all-read", notificationController.markAllRead);

module.exports = router;
