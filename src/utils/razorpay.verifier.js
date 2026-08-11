const crypto = require("crypto");

/**
 * Verify Razorpay Webhook Signature
 * @param {string} signature - Signature from x-razorpay-signature header
 * @param {string|Buffer} rawBody - Raw body string or buffer of request payload
 * @param {string} secret - Razorpay Webhook secret
 * @returns {boolean}
 */
const verifyRazorpayWebhook = (signature, rawBody, secret) => {
  if (!signature || !secret) return false;
  try {
    const bodyStr = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(bodyStr)
      .digest("hex");
    return expectedSignature === signature;
  } catch (err) {
    console.error("Error verifying Razorpay webhook signature:", err);
    return false;
  }
};

module.exports = {
  verifyRazorpayWebhook,
};
