const { z } = require("zod");

const buyTokensSchema = z.object({
  packId: z.enum(["pack-500", "pack-1500", "pack-5000"]),
  paymentReference: z.string().min(1, "paymentReference is required"),
  provider: z.enum(["paystack", "flutterwave"]).default("paystack"),
});

module.exports = { buyTokensSchema };
