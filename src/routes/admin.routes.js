const express = require("express");
const validate = require("../middleware/validate");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const {
  adminSigninSchema,
  refundTokensSchema,
  banUserSchema,
  adCampaignSchema,
  updateAdCampaignSchema,
} = require("../validators/adminValidators");
const adminController = require("../controllers/adminController");
const subjectController = require("../controllers/subjectController");
const questionController = require("../controllers/questionController");

const router = express.Router();

// Public: admin sign-in
router.post("/auth/admin/signin", validate(adminSigninSchema), adminController.adminSignin);

// Everything below requires an authenticated admin
router.use(requireAuth, requireAdmin);

// Subjects (CMS)
router.get("/admin/subjects", subjectController.adminListSubjects);
router.post("/admin/subjects", subjectController.adminUpsertSubject);
router.delete("/admin/subjects/:subjectId", subjectController.adminDeleteSubject);

// Questions (CMS)
router.get("/admin/questions", questionController.adminListQuestions);
router.post("/admin/questions", questionController.createQuestion);
router.put("/admin/questions/:id", questionController.updateQuestion);
router.delete("/admin/questions/:id", questionController.deleteQuestion);
router.post("/admin/questions/bulk-import", questionController.bulkImportQuestions);

// Users
router.get("/admin/users", adminController.listUsers);
router.get("/admin/users/:id", adminController.getUserDetail);
router.get("/admin/users/:id/attempts", adminController.getUserAttempts);
router.post("/admin/users/:id/refund-tokens", validate(refundTokensSchema), adminController.refundTokens);
router.post("/admin/users/:id/ban", validate(banUserSchema), adminController.setUserBanned);

// Ad campaigns
router.get("/admin/ads", adminController.adminListAds);
router.post("/admin/ads", validate(adCampaignSchema), adminController.adminCreateAd);
router.put("/admin/ads/:id", validate(updateAdCampaignSchema), adminController.adminUpdateAd);
router.delete("/admin/ads/:id", adminController.adminDeleteAd);

// Analytics
router.get("/admin/usage-summary", adminController.getUsageSummary);

module.exports = router;
