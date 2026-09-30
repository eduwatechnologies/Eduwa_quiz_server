const TokenWallet = require("../models/TokenWallet");
const TokenTransaction = require("../models/TokenTransaction");
const ApiError = require("../utils/ApiError");

async function getOrCreateWallet(userId) {
  let wallet = await TokenWallet.findOne({ userId });
  if (!wallet) {
    wallet = await TokenWallet.create({
      userId,
      totalTokens: parseInt(process.env.SIGNUP_BONUS_TOKENS || "1000", 10),
      usedTokens: 0,
    });
  }
  return wallet;
}

/**
 * Deducts `amount` tokens from the user's wallet if they have enough,
 * recording a token_transactions entry. Throws 402 if insufficient.
 */
async function debitTokens(userId, amount, reason, relatedId = null) {
  const wallet = await getOrCreateWallet(userId);
  const remaining = wallet.totalTokens - wallet.usedTokens;

  if (remaining < amount) {
    throw ApiError.paymentRequired(
      `Not enough tokens for this action (need ${amount}, have ${remaining}). Please purchase more tokens.`
    );
  }

  wallet.usedTokens += amount;
  await wallet.save();

  await TokenTransaction.create({
    userId,
    type: "spend",
    amount,
    balanceAfter: wallet.totalTokens - wallet.usedTokens,
    reason,
    relatedId,
  });

  return wallet;
}

/**
 * Adds `amount` tokens to the user's wallet (e.g. from a purchased pack),
 * recording a token_transactions entry.
 */
async function creditTokens(userId, amount, reason, relatedId = null) {
  const wallet = await getOrCreateWallet(userId);
  wallet.totalTokens += amount;
  await wallet.save();

  await TokenTransaction.create({
    userId,
    type: "purchase",
    amount,
    balanceAfter: wallet.totalTokens - wallet.usedTokens,
    reason,
    relatedId,
  });

  return wallet;
}

module.exports = { getOrCreateWallet, debitTokens, creditTokens };
