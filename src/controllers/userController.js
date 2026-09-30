const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const User = require("../models/User");
const { getOrCreateWallet } = require("../services/walletService");
const { computeUserStats } = require("../services/statsService");
const { uploadBuffer, isConfigured } = require("../services/storageService");
const { AI_QUIZ_TOKEN_COST, COACH_MESSAGE_TOKEN_COST } = require("../config/tokenCosts");

async function buildProfileResponse(user) {
  const [stats, wallet] = await Promise.all([
    computeUserStats(user._id),
    getOrCreateWallet(user._id),
  ]);

  const remaining = wallet.totalTokens - wallet.usedTokens;

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    course: user.course,
    examYear: user.examYear,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    stats,
    tokens: {
      total: wallet.totalTokens,
      used: wallet.usedTokens,
      remaining,
    },
    // AI features are unlocked by token balance, not a subscription. These
    // costs let the client show remaining-uses hints without duplicating config.
    access: {
      canUseAi: remaining >= AI_QUIZ_TOKEN_COST(),
      canUseCoach: remaining >= COACH_MESSAGE_TOKEN_COST(),
      aiQuizTokenCost: AI_QUIZ_TOKEN_COST(),
      coachMessageTokenCost: COACH_MESSAGE_TOKEN_COST(),
    },
    onboarding: { completed: user.onboardingCompleted },
  };
}

const getMe = asyncHandler(async (req, res) => {
  const body = await buildProfileResponse(req.user);
  res.status(200).json(body);
});

const updateMe = asyncHandler(async (req, res) => {
  const updates = req.body;

  if (updates.email && updates.email.toLowerCase() !== req.user.email) {
    const existing = await User.findOne({ email: updates.email.toLowerCase() });
    if (existing) {
      throw ApiError.validation("Validation failed", [
        { field: "email", message: "Email is already registered" },
      ]);
    }
  }

  Object.assign(req.user, updates);
  await req.user.save();

  const body = await buildProfileResponse(req.user);
  res.status(200).json(body);
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select("+passwordHash");
  const ok = await user.comparePassword(currentPassword);
  if (!ok) {
    throw ApiError.validation("Validation failed", [
      { field: "currentPassword", message: "Current password is incorrect" },
    ]);
  }

  await user.setPassword(newPassword);
  await user.save();

  res.status(204).send();
});

const completeOnboarding = asyncHandler(async (req, res) => {
  req.user.onboardingCompleted = true;
  await req.user.save();
  res.status(200).json({ completed: true });
});

const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB

const uploadAvatar = asyncHandler(async (req, res) => {
  if (!isConfigured()) {
    throw ApiError.badRequest(
      "Avatar uploads require object storage to be configured (set S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY in .env)"
    );
  }
  if (!req.file) {
    throw ApiError.badRequest("No file uploaded — send it as multipart/form-data field `avatar`");
  }
  if (!ALLOWED_AVATAR_TYPES.has(req.file.mimetype)) {
    throw ApiError.badRequest("Avatar must be a JPEG, PNG, or WebP image");
  }
  if (req.file.size > MAX_AVATAR_BYTES) {
    throw ApiError.badRequest("Avatar must be 5MB or smaller");
  }

  const ext = req.file.mimetype.split("/")[1];
  const key = `avatars/${req.user._id}-${Date.now()}.${ext}`;
  const url = await uploadBuffer(key, req.file.buffer, req.file.mimetype);

  req.user.avatarUrl = url;
  await req.user.save();

  res.status(200).json({ avatarUrl: url });
});

module.exports = { getMe, updateMe, changePassword, completeOnboarding, uploadAvatar, buildProfileResponse };
