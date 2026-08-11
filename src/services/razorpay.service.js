const Razorpay = require("razorpay");

/**
 * Initialize Razorpay Instance from environment
 */
const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error(
      "Razorpay API credentials (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET) are missing from environment variables."
    );
  }

  return new Razorpay({
    key_id,
    key_secret,
  });
};

/**
 * Create a Razorpay Payment Link
 * @param {Object} options
 * @param {Object} options.subscription
 * @param {Object} options.client
 * @param {number|string} options.amount - Amount in INR
 * @param {string} options.description
 * @returns {Promise<Object>} { success: true, paymentLink, url }
 */
const createPaymentLink = async ({ subscription, client, amount, description }) => {
  try {
    const instance = getRazorpayInstance();
    let amountInPaisa = Math.round(Number(amount) * 100);

    // If amount * 100 exceeds Razorpay test mode maximum single link limit (₹50,000 / 5,000,000 paise),
    // check if amount was already passed in paise or adjust
    if (amountInPaisa > 5000000) {
      if (Number(amount) <= 5000000) {
        // If amount was already in paise (e.g., 90000 paise = ₹900)
        amountInPaisa = Math.round(Number(amount));
      } else {
        // Cap at 50,000 INR (5,000,000 paise) for Razorpay test mode compatibility
        console.warn(`Amount ₹${amount} exceeds Razorpay single transaction limit. Capping to ₹50,000 for test mode.`);
        amountInPaisa = 5000000;
      }
    }

    if (isNaN(amountInPaisa) || amountInPaisa <= 0) {
      throw new Error("Invalid payment amount. Amount must be greater than 0.");
    }

    // ===== Dynamic expire_by based on subscription.end_date =====
    let expireByUnix;
    const nowUnix = Math.floor(Date.now() / 1000);
    const minAllowedUnix = nowUnix + 30 * 60; // Razorpay requires expire_by to be at least 15-30 mins in future

    if (subscription && subscription.end_date) {
      const endDateObj = new Date(subscription.end_date);
      // Set to 23:59:59 PM on the subscription's end_date
      endDateObj.setHours(23, 59, 59, 999);
      const targetUnix = Math.floor(endDateObj.getTime() / 1000);

      if (targetUnix > minAllowedUnix) {
        expireByUnix = targetUnix;
        console.log(`📅 Dynamically setting Payment Link expire_by to subscription end_date (${subscription.end_date} 23:59:59): Unix ${expireByUnix}`);
      } else {
        // If end_date is today or already passed, default to 7 days from now
        expireByUnix = nowUnix + 7 * 24 * 60 * 60;
        console.log(`⚠️ Subscription end_date (${subscription.end_date}) is past/today. Defaulting expire_by to 7 days from now: Unix ${expireByUnix}`);
      }
    } else {
      expireByUnix = nowUnix + 7 * 24 * 60 * 60;
    }

    const payload = {
      amount: amountInPaisa,
      currency: "INR",
      accept_partial: false,
      description: description || `Subscription Renewal #${subscription.id}`,
      customer: {
        name: client.company_name || client.contact_person || `Client #${subscription.client_id}`,
        email: client.email || undefined,
        contact: client.phone || undefined,
      },
      notify: {
        sms: Boolean(client.phone),
        email: Boolean(client.email),
      },
      reminder_enable: true,
      notes: {
        subscription_id: String(subscription.id),
        client_id: String(subscription.client_id),
      },
      callback_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/subscriptions`,
      callback_method: "get",
      expire_by: expireByUnix,
    };

    console.log("Creating Razorpay Payment Link with payload:", payload);
    const link = await instance.paymentLink.create(payload);

    return {
      success: true,
      paymentLink: link,
      url: link.short_url || link.url,
    };
  } catch (error) {
    console.error("Razorpay Service error in createPaymentLink:", error);
    return {
      success: false,
      error: error.message || "Failed to generate Razorpay Payment Link",
    };
  }
};

/**
 * Create a Razorpay Order for In-App Direct Checkout (Swiggy/Zomato style)
 * @param {Object} options
 * @param {Object} options.subscription
 * @param {number|string} options.amount
 * @returns {Promise<Object>} { success: true, order }
 */
const createOrder = async ({ subscription, amount }) => {
  try {
    const instance = getRazorpayInstance();
    let amountInPaisa = Math.round(Number(amount) * 100);

    if (amountInPaisa > 5000000) {
      if (Number(amount) <= 5000000) {
        amountInPaisa = Math.round(Number(amount));
      } else {
        amountInPaisa = 5000000;
      }
    }

    if (isNaN(amountInPaisa) || amountInPaisa <= 0) {
      throw new Error("Invalid payment amount. Amount must be greater than 0.");
    }

    const options = {
      amount: amountInPaisa,
      currency: "INR",
      receipt: `sub_${subscription.id}_${Date.now()}`,
      notes: {
        subscription_id: String(subscription.id),
        client_id: String(subscription.client_id),
      },
    };

    console.log("Creating Razorpay Order with payload:", options);
    const order = await instance.orders.create(options);

    return {
      success: true,
      order,
    };
  } catch (error) {
    console.error("Razorpay Service error in createOrder:", error);
    return {
      success: false,
      error: error.message || "Failed to create Razorpay Order",
    };
  }
};

/**
 * Verify Razorpay Payment Signature
 */
const verifyPaymentSignature = ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
  const crypto = require("crypto");
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_secret) {
    throw new Error("RAZORPAY_KEY_SECRET is missing from environment variables.");
  }

  const generatedSignature = crypto
    .createHmac("sha256", key_secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  return generatedSignature === razorpay_signature;
};

module.exports = {
  createPaymentLink,
  createOrder,
  verifyPaymentSignature,
};
