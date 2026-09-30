const express = require("express");
const { requireAuth } = require("../middleware/auth");
const adController = require("../controllers/adController");

const router = express.Router();

router.get("/banner", requireAuth, adController.getAdBanner);

module.exports = router;
