/**
 * Payment service — verifies transactions with Paystack or Flutterwave
 * (Nigeria-friendly providers per the recommended stack).
 *
 * In production, ALWAYS verify a paymentReference server-side against the
 * provider's API before crediting tokens — never trust a client-supplied
 * "success" flag.
 */

async function verifyPaystackTransaction(reference) {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    // No key configured: allow the scaffold to work in dev/demo mode.
    return { verified: true, amount: null, mock: true };
  }
  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    }
  );
  const data = await res.json();
  const ok = data?.data?.status === "success";
  return { verified: ok, amount: data?.data?.amount ? data.data.amount / 100 : null, raw: data };
}

async function verifyFlutterwaveTransaction(reference) {
  if (!process.env.FLUTTERWAVE_SECRET_KEY) {
    return { verified: true, amount: null, mock: true };
  }
  const res = await fetch(
    `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(reference)}/verify`,
    {
      headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
    }
  );
  const data = await res.json();
  const ok = data?.data?.status === "successful";
  return { verified: ok, amount: data?.data?.amount || null, raw: data };
}

/**
 * Verifies a payment reference with the given provider.
 * @param {"paystack"|"flutterwave"} provider
 * @param {string} reference
 */
async function verifyTransaction(provider, reference) {
  if (provider === "flutterwave") return verifyFlutterwaveTransaction(reference);
  return verifyPaystackTransaction(reference);
}

module.exports = { verifyTransaction };
