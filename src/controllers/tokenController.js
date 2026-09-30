const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { TOKEN_PACKS } = require("../config/tokenPacks");
const { verifyTransaction } = require("../services/paymentService");
const { creditTokens, getOrCreateWallet } = require("../services/walletService");
const PaymentTransaction = require("../models/PaymentTransaction");
const TokenTransaction = require("../models/TokenTransaction");

const getWallet = asyncHandler(async (req, res) => {
  const wallet = await getOrCreateWallet(req.user._id);
  res.status(200).json({
    total: wallet.totalTokens,
    used: wallet.usedTokens,
    remaining: wallet.totalTokens - wallet.usedTokens,
  });
});

const buyTokens = asyncHandler(async (req, res) => {
  const { packId, paymentReference, provider } = req.body;
  const pack = TOKEN_PACKS[packId];
  if (!pack) throw ApiError.badRequest("Unknown packId");

  const existingTxn = await PaymentTransaction.findOne({ reference: paymentReference });
  if (existingTxn && existingTxn.status === "success") {
    throw ApiError.conflict("This payment reference has already been processed");
  }

  const verification = await verifyTransaction(provider, paymentReference);
  if (!verification.verified) {
    throw ApiError.badRequest("Payment could not be verified with the provider");
  }

  const txn = await PaymentTransaction.findOneAndUpdate(
    { reference: paymentReference },
    {
      userId: req.user._id,
      type: "token_purchase",
      amount: pack.priceNGN,
      currency: "NGN",
      provider,
      reference: paymentReference,
      status: "success",
      metadata: { packId, mock: !!verification.mock },
    },
    { upsert: true, new: true }
  );

  const wallet = await creditTokens(req.user._id, pack.tokens, `${packId} purchase`, txn._id.toString());

  res.status(200).json({
    success: true,
    tokensAdded: pack.tokens,
    newTotal: wallet.totalTokens,
    newRemaining: wallet.totalTokens - wallet.usedTokens,
    transactionId: txn._id.toString(),
  });
});

const listTransactions = asyncHandler(async (req, res) => {
  const items = await TokenTransaction.find({ userId: req.user._id }).sort({ createdAt: -1 });

  res.status(200).json({
    items: items.map((t) => ({
      id: t._id.toString(),
      type: t.type,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      reason: t.reason,
      createdAt: t.createdAt,
    })),
  });
});

module.exports = { getWallet, buyTokens, listTransactions };
