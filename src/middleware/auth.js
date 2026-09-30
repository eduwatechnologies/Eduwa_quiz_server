const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { verifyAccessToken } = require("../utils/jwt");
const User = require("../models/User");

/**
 * Requires a valid Bearer access token. Attaches the full user document
 * (minus password hash) to req.user.
 */
const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw ApiError.unauthorized("Missing or malformed Authorization header");
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    throw ApiError.unauthorized("Invalid or expired access token");
  }

  const user = await User.findById(payload.sub).select("-passwordHash");
  if (!user) {
    throw ApiError.unauthorized("User no longer exists");
  }
  if (user.status === "blocked") {
    throw new ApiError(403, "Account blocked / unverified");
  }

  req.user = user;
  req.tokenPayload = payload;
  next();
});

/**
 * Requires the authenticated user to have the admin role.
 * Always use after requireAuth.
 */
const requireAdmin = asyncHandler(async (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    throw ApiError.forbidden("Admin access required");
  }
  next();
});

module.exports = { requireAuth, requireAdmin };
