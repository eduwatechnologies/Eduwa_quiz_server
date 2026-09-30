const express = require("express");
const { requireAuth } = require("../middleware/auth");
const homeController = require("../controllers/homeController");

const router = express.Router();

router.get("/", requireAuth, homeController.getHome);

module.exports = router;
