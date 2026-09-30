const express = require("express");
const multer = require("multer");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { updateProfileSchema } = require("../validators/userValidators");
const { changePasswordSchema } = require("../validators/authValidators");
const { notificationPrefsSchema } = require("../validators/notificationValidators");
const { updateSettingsSchema } = require("../validators/settingsValidators");
const userController = require("../controllers/userController");
const notificationController = require("../controllers/notificationController");
const settingsController = require("../controllers/settingsController");

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // in-memory, 5MB cap

const router = express.Router();

router.use(requireAuth);

router.get("/me", userController.getMe);
router.put("/me", validate(updateProfileSchema), userController.updateMe);
router.post("/me/password", validate(changePasswordSchema), userController.changePassword);
router.post("/me/avatar", upload.single("avatar"), userController.uploadAvatar);

router.get("/me/notifications", notificationController.getPreferences);
router.put(
  "/me/notifications",
  validate(notificationPrefsSchema),
  notificationController.updatePreferences
);

router.get("/me/settings", settingsController.getSettings);
router.put("/me/settings", validate(updateSettingsSchema), settingsController.updateSettings);

module.exports = router;
