const mongoose = require("mongoose");

const paymentTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // "premium_subscription" is retained for historical rows only. Subscriptions
    // were removed in favour of token packs; do not write new ones.
    type: {
      type: String,
      enum: ["token_purchase", "premium_subscription"],
      required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "NGN" },
    provider: { type: String, enum: ["paystack", "flutterwave"], required: true },
    reference: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PaymentTransaction", paymentTransactionSchema);
