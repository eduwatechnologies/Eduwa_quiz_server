const mongoose = require("mongoose");

const tokenWalletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    totalTokens: { type: Number, default: 0 },
    usedTokens: { type: Number, default: 0 },
  },
  { timestamps: true }
);

tokenWalletSchema.virtual("remaining").get(function () {
  return Math.max(this.totalTokens - this.usedTokens, 0);
});
tokenWalletSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("TokenWallet", tokenWalletSchema);
