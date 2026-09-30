const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const User = require("../models/User");
const QuizAttempt = require("../models/QuizAttempt");
const PaymentTransaction = require("../models/PaymentTransaction");
const TokenTransaction = require("../models/TokenTransaction");
const AdCampaign = require("../models/AdCampaign");
const { signAccessToken, signRefreshToken, expiresAtFromNow } = require("../utils/jwt");
const { creditTokens, getOrCreateWallet } = require("../services/walletService");
const { computeUserStats } = require("../services/statsService");
const Session = require("../models/Session");

const adminSignin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase(), role: "admin" }).select(
    "+passwordHash"
  );
  if (!user) throw ApiError.unauthorized("Invalid admin credentials");

  const ok = await user.comparePassword(password);
  if (!ok) throw ApiError.unauthorized("Invalid admin credentials");

  const accessToken = signAccessToken(user);
  const { token: refreshToken, jti } = signRefreshToken(user);
  await Session.create({
    userId: user._id,
    refreshTokenJti: jti,
    expiresAt: new Date(expiresAtFromNow(process.env.JWT_REFRESH_EXPIRES_IN || "30d")),
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });

  res.status(200).json({
    user: user.toPublicJSON(),
    session: {
      accessToken,
      refreshToken,
      expiresAt: expiresAtFromNow(process.env.JWT_ACCESS_EXPIRES_IN || "15m"),
    },
  });
});

const listUsers = asyncHandler(async (req, res) => {
  const { search, limit = 20, offset = 0 } = req.query;

  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const parsedLimit = Math.min(parseInt(limit, 10) || 20, 100);
  const parsedOffset = parseInt(offset, 10) || 0;

  const [items, count] = await Promise.all([
    User.find(filter).skip(parsedOffset).limit(parsedLimit).sort({ createdAt: -1 }),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    items: items.map((u) => ({ ...u.toPublicJSON(), role: u.role, status: u.status })),
    count,
  });
});

const getUserDetail = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound("User not found");

  const [stats, wallet] = await Promise.all([
    computeUserStats(user._id),
    getOrCreateWallet(user._id),
  ]);

  res.status(200).json({
    ...user.toPublicJSON(),
    role: user.role,
    status: user.status,
    stats,
    tokens: {
      total: wallet.totalTokens,
      used: wallet.usedTokens,
      remaining: wallet.totalTokens - wallet.usedTokens,
    },
  });
});

const refundTokens = asyncHandler(async (req, res) => {
  const { amount, reason } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound("User not found");

  const wallet = await creditTokens(user._id, amount, reason, `admin:${req.user._id}`);

  res.status(200).json({
    userId: user._id.toString(),
    newTotal: wallet.totalTokens,
    newRemaining: wallet.totalTokens - wallet.usedTokens,
  });
});

const setUserBanned = asyncHandler(async (req, res) => {
  const { banned } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound("User not found");

  user.status = banned ? "blocked" : "active";
  await user.save();

  res.status(200).json({ userId: user._id.toString(), status: user.status });
});

const getUserAttempts = asyncHandler(async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound("User not found");

  const parsedLimit = Math.min(parseInt(limit, 10) || 20, 100);
  const parsedOffset = parseInt(offset, 10) || 0;

  const [items, count] = await Promise.all([
    QuizAttempt.find({ userId: user._id })
      .sort({ completedAt: -1 })
      .skip(parsedOffset)
      .limit(parsedLimit),
    QuizAttempt.countDocuments({ userId: user._id }),
  ]);

  res.status(200).json({
    items: items.map((a) => ({
      id: a._id.toString(),
      subjectName: a.subjectName,
      topic: a.topic,
      mode: a.mode,
      questionsCount: a.questionsCount,
      score: a.score,
      percentage: a.percentage,
      completedAt: a.completedAt,
    })),
    count,
  });
});

// --- Ad campaigns ---

const adminListAds = asyncHandler(async (req, res) => {
  const { placement } = req.query;
  const filter = {};
  if (placement) filter.placement = placement;

  const ads = await AdCampaign.find(filter).sort({ createdAt: -1 });
  res.status(200).json(ads);
});

const adminCreateAd = asyncHandler(async (req, res) => {
  const ad = await AdCampaign.create(req.body);
  res.status(201).json(ad);
});

const adminUpdateAd = asyncHandler(async (req, res) => {
  const ad = await AdCampaign.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!ad) throw ApiError.notFound("Ad campaign not found");
  res.status(200).json(ad);
});

const adminDeleteAd = asyncHandler(async (req, res) => {
  const ad = await AdCampaign.findByIdAndDelete(req.params.id);
  if (!ad) throw ApiError.notFound("Ad campaign not found");
  res.status(204).send();
});

const getUsageSummary = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [dau, mau, totalUsers, tokensSoldAgg, tokenTransactions] = await Promise.all([
    QuizAttempt.distinct("userId", { completedAt: { $gte: startOfToday } }).then((a) => a.length),
    QuizAttempt.distinct("userId", { completedAt: { $gte: startOfMonth } }).then((a) => a.length),
    User.countDocuments(),
    PaymentTransaction.aggregate([
      { $match: { type: "token_purchase", status: "success" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    TokenTransaction.aggregate([
      { $group: { _id: "$type", total: { $sum: "$amount" } } },
    ]),
  ]);

  const tokensByType = tokenTransactions.reduce((acc, row) => {
    acc[row._id] = row.total;
    return acc;
  }, {});

  res.status(200).json({
    dau,
    mau,
    totalUsers,
    tokensSoldRevenueNGN: tokensSoldAgg[0]?.total || 0,
    tokensPurchased: tokensByType.purchase || 0,
    tokensSpent: tokensByType.spend || 0,
    generatedAt: now.toISOString(),
  });
});

module.exports = {
  adminSignin,
  listUsers,
  getUserDetail,
  refundTokens,
  setUserBanned,
  getUserAttempts,
  adminListAds,
  adminCreateAd,
  adminUpdateAd,
  adminDeleteAd,
  getUsageSummary,
};
