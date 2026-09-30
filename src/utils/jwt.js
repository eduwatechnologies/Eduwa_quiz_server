const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role || "user", type: "access" },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m" }
  );
}

function signRefreshToken(user) {
  const jti = uuidv4();
  const token = jwt.sign(
    { sub: user._id.toString(), type: "refresh", jti },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d" }
  );
  return { token, jti };
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

function expiresAtFromNow(durationString) {
  // Very small helper to turn things like "15m", "30d" into an ISO date.
  const match = /^(\d+)([smhd])$/.exec(durationString || "15m");
  const now = new Date();
  if (!match) return new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return new Date(now.getTime() + value * multipliers[unit]).toISOString();
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  expiresAtFromNow,
};
