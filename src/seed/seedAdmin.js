require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB } = require("../config/db");
const User = require("../models/User");
const TokenWallet = require("../models/TokenWallet");

/**
 * Seeds (or repairs) the admin account used by the dashboard's
 * POST /api/auth/admin/signin.
 *
 * Credentials come from ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD.
 * Run with --reset to force the stored password back to the env value, which
 * is what you want after changing the password in .env.
 */
async function seedAdmin({ reset = false } = {}) {
  const email = (process.env.ADMIN_BOOTSTRAP_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!email || !password) {
    console.log(
      "[seed:admin] skipped — set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD in .env"
    );
    return null;
  }

  let admin = await User.findOne({ email });

  if (admin) {
    // An existing account with this email may be a normal sign-up that was
    // never promoted, which would make admin sign-in fail with 401.
    if (admin.role !== "admin") {
      admin.role = "admin";
      await admin.save();
      console.log(`[seed:admin] promoted existing user to admin: ${email}`);
    } else {
      console.log(`[seed:admin] admin already exists: ${email}`);
    }

    if (admin.status === "blocked") {
      admin.status = "active";
      await admin.save();
      console.log("[seed:admin] unblocked admin account");
    }

    if (reset) {
      await admin.setPassword(password);
      await admin.save();
      console.log("[seed:admin] password reset from ADMIN_BOOTSTRAP_PASSWORD");
    }
  } else {
    admin = new User({
      name: process.env.ADMIN_BOOTSTRAP_NAME || "Eduwa Admin",
      email,
      course: "N/A",
      examYear: "N/A",
      role: "admin",
      status: "active",
    });
    await admin.setPassword(password);
    await admin.save();
    console.log(`[seed:admin] created admin user: ${email}`);
  }

  // Admins don't spend tokens, but the wallet must exist so admin reads of
  // user/token data don't have to lazily create one mid-request.
  await TokenWallet.findOneAndUpdate(
    { userId: admin._id },
    { $setOnInsert: { totalTokens: 0, usedTokens: 0 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return admin;
}

async function run() {
  await connectDB();
  const admin = await seedAdmin({ reset: process.argv.includes("--reset") });
  if (admin) {
    console.log(`[seed:admin] ready — sign in at POST /api/auth/admin/signin as ${admin.email}`);
  }
  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch((err) => {
    console.error("[seed:admin] failed:", err);
    process.exit(1);
  });
}

module.exports = { seedAdmin };
