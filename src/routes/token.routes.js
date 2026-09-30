const express = require("express");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { buyTokensSchema } = require("../validators/tokenValidators");
const tokenController = require("../controllers/tokenController");

const router = express.Router();

router.use(requireAuth);

router.get("/", tokenController.getWallet);
router.post("/buy", validate(buyTokensSchema), tokenController.buyTokens);
router.get("/transactions", tokenController.listTransactions);

module.exports = router;
