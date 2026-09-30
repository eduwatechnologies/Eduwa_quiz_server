const crypto = require("crypto");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const User = require("../models/User");
const Session = require("../models/Session");
const TokenWallet = require("../models/TokenWallet");
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  expiresAtFromNow,
} = require("../utils/jwt");
const { sendPasswordResetEmail } = require("../services/emailService");

async function buildSessionResponse(user, req) {
  const accessToken = signAccessToken(user);
  const { token: refreshToken, jti } = signRefreshToken(user);

  await Session.create({
    userId: user._id,
    refreshTokenJti: jti,
    expiresAt: new Date(expiresAtFromNow(process.env.JWT_REFRESH_EXPIRES_IN || "30d")),
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });

  return {
    user: user.toPublicJSON(),
    session: {
      accessToken,
      refreshToken,
      expiresAt: expiresAtFromNow(process.env.JWT_ACCESS_EXPIRES_IN || "15m"),
    },
    onboarding: { completed: user.onboardingCompleted },
  };
}

const signup = asyncHandler(async (req, res) => {
  console.log(req.body, "the data...")
  const { name, email, password, course, examYear } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw ApiError.validation("Validation failed", [
      { field: "email", message: "Email is already registered" },
    ]);
  }
  

  const user = new User({ name, email, course, examYear });
  await user.setPassword(password);
  await user.save();

  await TokenWallet.create({
    userId: user._id,
    totalTokens: parseInt(process.env.SIGNUP_BONUS_TOKENS || "1000", 10),
    usedTokens: 0,
  });

  const body = await buildSessionResponse(user, req);
  res.status(201).json(body);
});

const signin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!user) throw ApiError.unauthorized("Invalid credentials");

  const ok = await user.comparePassword(password);
  if (!ok) throw ApiError.unauthorized("Invalid credentials");

  if (user.status === "blocked" || user.status === "unverified") {
    throw new ApiError(403, "Account blocked / unverified");
  }

  const body = await buildSessionResponse(user, req);
  res.status(200).json(body);
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const session = await Session.findOne({ refreshTokenJti: payload.jti, revokedAt: null });
  if (!session || session.expiresAt < new Date()) {
    throw ApiError.unauthorized("Refresh token no longer valid");
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized("User no longer exists");

  // Rotate: revoke old session, issue new access + refresh token
  session.revokedAt = new Date();
  await session.save();

  const accessToken = signAccessToken(user);
  const { token: newRefreshToken, jti } = signRefreshToken(user);
  await Session.create({
    userId: user._id,
    refreshTokenJti: jti,
    expiresAt: new Date(expiresAtFromNow(process.env.JWT_REFRESH_EXPIRES_IN || "30d")),
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });

  res.status(200).json({
    accessToken,
    refreshToken: newRefreshToken,
    expiresAt: expiresAtFromNow(process.env.JWT_ACCESS_EXPIRES_IN || "15m"),
  });
});

const signout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await Session.findOneAndUpdate(
        { refreshTokenJti: payload.jti },
        { revokedAt: new Date() }
      );
    } catch (err) {
      // Token already invalid/expired — signout is idempotent either way.
    }
  }
  res.status(204).send();
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });

  // Always respond the same way whether or not the user exists, to avoid
  // leaking which emails are registered.
  if (user) {
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    await sendPasswordResetEmail(user, resetToken);
  }

  res.status(200).json({
    message: "If that email is registered, a reset link has been sent.",
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    resetTokenHash: tokenHash,
    resetTokenExpiresAt: { $gt: new Date() },
  }).select("+resetTokenHash +resetTokenExpiresAt");

  if (!user) {
    throw ApiError.badRequest("Reset token is invalid or has expired");
  }

  await user.setPassword(newPassword);
  user.resetTokenHash = null;
  user.resetTokenExpiresAt = null;
  await user.save();

  // Invalidate all existing sessions so a stolen refresh token can't
  // outlive the password change.
  await Session.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });

  res.status(200).json({ message: "Password has been reset. Please sign in again." });
});

module.exports = {
  signup,
  signin,
  refresh,
  signout,
  forgotPassword,
  resetPassword,
};
