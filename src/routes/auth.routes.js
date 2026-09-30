const express = require("express");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const {
  signupSchema,
  signinSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../validators/authValidators");
const authController = require("../controllers/authController");

const router = express.Router();

router.post("/signup", validate(signupSchema), authController.signup);
router.post("/signin", validate(signinSchema), authController.signin);
router.post("/refresh", validate(refreshSchema), authController.refresh);
router.post("/signout", requireAuth, authController.signout);
router.post("/forgot-password", validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), authController.resetPassword);

module.exports = router;
