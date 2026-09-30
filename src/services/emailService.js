/**
 * Email service — sends transactional emails via Resend
 * (https://resend.com), per the recommended stack.
 *
 * With no RESEND_API_KEY configured, sendEmail logs the message instead of
 * sending it, so auth flows (password reset, etc.) stay testable without a
 * live Resend account.
 */

async function sendEmail({ to, subject, html, text }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email:mock] to=${to} subject="${subject}"\n${text || html}`);
    return { sent: false, mock: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "Eduwa Quiz <no-reply@eduwa.app>",
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Resend email send failed (${res.status}): ${errText}`);
  }

  return { sent: true };
}

async function sendPasswordResetEmail(user, rawResetToken) {
  const origin =
    process.env.CLIENT_ORIGIN && process.env.CLIENT_ORIGIN !== "*" ? process.env.CLIENT_ORIGIN : "";
  const resetUrl = `${origin}/reset-password?token=${rawResetToken}`;

  return sendEmail({
    to: user.email,
    subject: "Reset your Eduwa Quiz password",
    text: `Hi ${user.name},\n\nUse this link to reset your password (valid for 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `<p>Hi ${user.name},</p><p>Use the link below to reset your password (valid for 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
  });
}

module.exports = { sendEmail, sendPasswordResetEmail };
