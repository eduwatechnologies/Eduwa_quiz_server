const mongoose = require("mongoose");

const tokenTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["purchase", "spend"], required: true },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reason: { type: String, required: true },
    relatedId: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TokenTransaction", tokenTransactionSchema);
