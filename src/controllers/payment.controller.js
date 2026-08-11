const razorpayService = require("../services/razorpay.service");
const masterModel = require("../models/masterModel");
const { verifyRazorpayWebhook } = require("../utils/razorpay.verifier");

// ===================================================================
// PAYMENT CONTROLLER - Razorpay Payment Link Management
// ===================================================================

/**
 * Generate Payment Link for a Subscription
 * POST /api/v1/payments/generate-link/:subscriptionId
 */
const generatePaymentLinkForSubscription = async (req, reply) => {
  try {
    const { subscriptionId } = req.params;

    console.log(`Generating payment link for subscription: ${subscriptionId}`);

    if (!subscriptionId) {
      return reply.code(400).send({
        success: false,
        message: "Subscription ID is required",
      });
    }

    // ===== STEP 1: Fetch Subscription Data =====
    const subscriptionQuery = `
      SELECT 
        s.id,
        s.client_id,
        s.device_plan_id,
        s.device_count,
        s.description,
        s.start_date,
        s.end_date,
        s.duration_days,
        s.price,
        s.status,
        s.created_by,
        c.company_name,
        c.contact_person,
        c.email,
        c.phone
      FROM subscriptions s
      JOIN client_info c ON s.client_id = c.id
      WHERE s.id = $1
    `;

    const subscriptionResult = await masterModel.customSelectSqlQuery2(
      subscriptionQuery,
      [subscriptionId]
    );

    if (!subscriptionResult || subscriptionResult.length === 0) {
      console.error(`Subscription not found: ${subscriptionId}`);
      return reply.code(404).send({
        success: false,
        message: "Subscription not found",
      });
    }

    const subscription = subscriptionResult[0];
    const client = {
      company_name: subscription.company_name,
      contact_person: subscription.contact_person,
      email: subscription.email,
      phone: subscription.phone,
    };

    console.log(`✅ Subscription found: ${subscription.company_name}`);

    // ===== STEP 2: Check if Recent Payment Link Exists =====
    console.log(`   Checking for recent payment links...`);

    const recentLinkQuery = `
      SELECT 
        id,
        razorpay_payment_link_id,
        payment_link_url,
        status,
        created_at
      FROM payments
      WHERE subscription_id = $1
      AND status IN ('created', 'paid')
      AND created_at > NOW() - INTERVAL '3 days'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const recentLinkResult = await masterModel.customSelectSqlQuery2(
      recentLinkQuery,
      [subscriptionId]
    );

    if (recentLinkResult && recentLinkResult.length > 0) {
      const existingLink = recentLinkResult[0];

      console.log(`   Found existing link: ${existingLink.razorpay_payment_link_id}`);

      // If link was paid, don't create new one
      if (existingLink.status === "paid") {
        return reply.code(400).send({
          success: false,
          message: "Payment already completed for this subscription",
          paymentLink: existingLink,
        });
      }

      // If link is recent and unpaid, return existing link
      console.log(`   Returning existing unpaid link`);
      return reply.send({
        success: true,
        message: "Payment link already exists",
        paymentLink: existingLink,
      });
    }

    console.log(`   No recent links found, creating new one...`);

    // ===== STEP 3: Create Razorpay Payment Link =====
    const paymentLinkResult = await razorpayService.createPaymentLink({
      subscription,
      client,
      amount: subscription.price,
      description: `Subscription Renewal - Subscription ID: ${subscription.id}`,
    });

    if (!paymentLinkResult.success) {
      console.error("Failed to create Razorpay payment link:", paymentLinkResult.error);
      return reply.code(500).send({
        success: false,
        message: paymentLinkResult.error || "Failed to create payment link",
      });
    }

    const paymentLinkData = paymentLinkResult.paymentLink;

    console.log(`✅ Razorpay payment link created: ${paymentLinkData.id}`);

    // ===== STEP 4: Save Payment Link to Database =====
    const paymentInsertQuery = `
      INSERT INTO payments 
      (subscription_id, client_id, razorpay_payment_link_id, amount, currency, payment_link_url, status, expiry_date, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING id, razorpay_payment_link_id, payment_link_url, status, created_at
    `;

    const paymentData = await masterModel.customSelectSqlQuery2(
      paymentInsertQuery,
      [
        subscriptionId,
        subscription.client_id,
        paymentLinkData.id,
        subscription.price,
        "INR",
        paymentLinkResult.url,
        "created",
        paymentLinkData.expire_by ? new Date(paymentLinkData.expire_by * 1000) : null,
      ]
    );

    console.log(`✅ Payment record saved to database`);

    // ===== STEP 5: Log to Audit Table =====
    await logPaymentAction(subscriptionId, paymentLinkData.id, "created", {
      amount: subscription.price,
      link_url: paymentLinkResult.url,
    });

    console.log(`✅ Payment action logged to audit table`);

    reply.code(201).send({
      success: true,
      message: "Payment link generated successfully",
      paymentLink: {
        id: paymentData[0]?.id,
        subscription_id: subscriptionId,
        razorpay_payment_link_id: paymentLinkData.id,
        payment_link_url: paymentLinkResult.url,
        amount: subscription.price,
        currency: "INR",
        status: "created",
        expiry_date: paymentLinkData.expire_by ? new Date(paymentLinkData.expire_by * 1000) : null,
      },
    });
  } catch (error) {
    console.error("❌ Error in generatePaymentLinkForSubscription:", error);
    reply.code(500).send({
      success: false,
      message: error.message || "Failed to generate payment link",
    });
  }
};

/**
 * Get Payment History for Subscription
 * GET /api/v1/payments/subscription/:subscriptionId
 */
const getPaymentsBySubscription = async (req, reply) => {
  try {
    const { subscriptionId } = req.params;

    console.log(`📋 Fetching payments for subscription: ${subscriptionId}`);

    const query = `
      SELECT 
        id,
        subscription_id,
        client_id,
        razorpay_payment_link_id,
        razorpay_payment_id,
        amount,
        currency,
        payment_link_url,
        status,
        expiry_date,
        paid_at,
        created_at,
        updated_at
      FROM payments
      WHERE subscription_id = $1
      ORDER BY created_at DESC
    `;

    const payments = await masterModel.customSelectSqlQuery2(query, [
      subscriptionId,
    ]);

    console.log(`✅ Found ${payments?.length || 0} payment(s)`);

    reply.send({
      success: true,
      payments: payments || [],
      total: payments?.length || 0,
    });
  } catch (error) {
    console.error("❌ Error fetching payments:", error);
    reply.code(500).send({
      success: false,
      message: error.message || "Failed to fetch payments",
    });
  }
};

/**
 * Razorpay Webhook Handler
 * POST /api/v1/payments/razorpay-webhook
 *
 * IMPORTANT: This route should NOT have auth middleware
 * Razorpay servers need to access it without authentication
 */
const handleRazorpayWebhook = async (req, reply) => {
  try {
    console.log("\n📨 Razorpay Webhook Received");

    // ===== STEP 1: Get Signature from Headers =====
    const signature = req.headers["x-razorpay-signature"];

    if (!signature) {
      console.warn("⚠️  No signature in webhook request");
      return reply.code(400).send({
        success: false,
        message: "Missing Razorpay signature",
      });
    }

    // ===== STEP 2: Get Raw Body =====
    const rawBody = req.rawBody || JSON.stringify(req.body);

    // ===== STEP 3: Verify Webhook Signature =====
    const isValid = verifyRazorpayWebhook(
      signature,
      rawBody,
      process.env.RAZORPAY_WEBHOOK_SECRET
    );

    if (!isValid) {
      console.error("❌ Invalid webhook signature");
      return reply.code(403).send({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    console.log("✅ Webhook signature verified");

    // ===== STEP 4: Parse Event Data =====
    const event = req.body.event;
    const payload = req.body.payload;

    console.log(`📨 Event Type: ${event}`);

    // ===== STEP 5: Handle Different Events =====
    if (event === "payment_link.paid") {
      await handlePaymentLinkPaid(payload);
    } else if (event === "payment_link.expired") {
      await handlePaymentLinkExpired(payload);
    } else if (event === "payment_link.cancelled") {
      await handlePaymentLinkCancelled(payload);
    } else {
      console.log(`⚠️  Unhandled event type: ${event}`);
    }

    // Always return 200 OK to acknowledge receipt
    reply.code(200).send({
      success: true,
      message: "Webhook received and processed",
    });
  } catch (error) {
    console.error("❌ Error handling webhook:", error);

    // Still return 200 to prevent Razorpay from retrying
    reply.code(200).send({
      success: false,
      message: "Webhook processed with errors (logged)",
    });
  }
};

/**
 * Handle payment.link.paid event
 * Auto-renew subscription when payment is received
 */
const handlePaymentLinkPaid = async (payload) => {
  try {
    console.log("💳 Processing payment link paid event");

    const linkId = payload.payment_link.entity.id;
    const paymentId = payload.payment.entity.id;
    const amount = payload.payment.entity.amount / 100; // Convert from paise

    console.log(`   Link ID: ${linkId}`);
    console.log(`   Payment ID: ${paymentId}`);
    console.log(`   Amount: ₹${amount}`);

    // ===== STEP 1: Find Payment Record =====
    const paymentQuery = `
      SELECT 
        id,
        subscription_id,
        client_id
      FROM payments
      WHERE razorpay_payment_link_id = $1
    `;

    const paymentResult = await masterModel.customSelectSqlQuery2(paymentQuery, [
      linkId,
    ]);

    if (!paymentResult || paymentResult.length === 0) {
      console.error("❌ Payment record not found for link:", linkId);
      return;
    }

    const payment = paymentResult[0];
    const subscriptionId = payment.subscription_id;

    console.log(`   Subscription ID: ${subscriptionId}`);

    // ===== STEP 2: Update Payment Status =====
    const updatePaymentQuery = `
      UPDATE payments
      SET 
        status = 'paid',
        razorpay_payment_id = $1,
        paid_at = NOW(),
        updated_at = NOW()
      WHERE razorpay_payment_link_id = $2
      RETURNING id, status
    `;

    await masterModel.customSelectSqlQuery2(updatePaymentQuery, [
      paymentId,
      linkId,
    ]);

    console.log(`   ✅ Payment marked as paid`);

    // ===== STEP 3: Fetch Subscription to Get Details & Duration =====
    const subscriptionQuery = `
      SELECT 
        id,
        client_id,
        application_id,
        device_plan_id,
        device_count,
        description,
        start_date,
        end_date,
        duration_days,
        price,
        status,
        created_by
      FROM subscriptions
      WHERE id = $1
    `;

    const subscriptionResult = await masterModel.customSelectSqlQuery2(
      subscriptionQuery,
      [subscriptionId]
    );

    if (!subscriptionResult || subscriptionResult.length === 0) {
      console.error("❌ Subscription not found:", subscriptionId);
      return;
    }

    const subscription = subscriptionResult[0];
    const durationDays = subscription.duration_days || 30;

    console.log(`   Duration: ${durationDays} days`);

    // ===== STEP 4: Calculate New Subscription Dates =====
    const currentEndDate = new Date(subscription.end_date);
    const today = new Date();

    // If expired, start from today; otherwise extend from current end_date
    let newStartDate;
    if (currentEndDate < today) {
      newStartDate = today;
      console.log(`   Subscription was expired, extending from today`);
    } else {
      newStartDate = currentEndDate;
      console.log(`   Subscription is active, extending from current end date`);
    }

    const newEndDate = new Date(newStartDate);
    newEndDate.setDate(newEndDate.getDate() + durationDays);

    const newStartDateStr = newStartDate.toISOString().split("T")[0];
    const newEndDateStr = newEndDate.toISOString().split("T")[0];

    console.log(`   New Start Date: ${newStartDateStr}`);
    console.log(`   New End Date: ${newEndDateStr}`);

    // Mark previous subscription record as expired
    await masterModel.customSelectSqlQuery2(
      `UPDATE subscriptions SET status = 'expired'::subscription_status, updated_at = NOW() WHERE id = $1`,
      [subscriptionId]
    );

    // ===== STEP 5: Insert NEW Subscription Record for this Transaction =====
    const insertSubscriptionQuery = `
      INSERT INTO subscriptions (
        client_id,
        application_id,
        device_plan_id,
        device_count,
        description,
        start_date,
        end_date,
        status,
        created_by,
        duration_days,
        price,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::DATE, $7::DATE, 'active'::subscription_status, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `;

    const newSubResult = await masterModel.customSelectSqlQuery2(
      insertSubscriptionQuery,
      [
        subscription.client_id,
        subscription.application_id || null,
        subscription.device_plan_id || null,
        subscription.device_count || 1,
        subscription.description || `Transaction renewal for subscription #${subscriptionId}`,
        newStartDateStr,
        newEndDateStr,
        subscription.created_by || 1,
        durationDays,
        subscription.price != null ? Number(subscription.price) : 0,
      ]
    );

    const newSubscription = newSubResult[0];
    console.log(`   ✅ New Subscription transaction record #${newSubscription.id} inserted successfully`);

    // ===== STEP 5.5: Insert Completed Record into Transactions Table =====
    try {
      const insertTxQuery = `
        INSERT INTO transactions (
          transaction_id,
          order_id,
          subscription_id,
          client_id,
          amount,
          currency,
          payment_method,
          status,
          paid_at,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'paid', NOW(), NOW())
        ON CONFLICT (transaction_id) DO NOTHING
        RETURNING id
      `;

      await masterModel.customSelectSqlQuery2(insertTxQuery, [
        paymentId,
        linkId,
        newSubscription ? newSubscription.id : subscriptionId,
        subscription.client_id,
        amount,
        "INR",
        "razorpay",
      ]);
      console.log(`   ✅ Clean transaction record saved to public.transactions table`);
    } catch (txErr) {
      console.error("Warning: Failed to insert into transactions table:", txErr.message);
    }

    // ===== STEP 6: Log Renewal Action =====
    await logPaymentAction(newSubscription.id, linkId, "paid", {
      payment_id: paymentId,
      amount,
      old_subscription_id: subscriptionId,
      new_end_date: newEndDateStr,
      new_status: "active",
      duration_days: durationDays,
    });

    console.log("✅ Payment link paid event processed successfully\n");
  } catch (error) {
    console.error("❌ Error handling payment.link.paid:", error);
  }
};

/**
 * Handle payment.link.expired event
 */
const handlePaymentLinkExpired = async (payload) => {
  try {
    console.log("⏰ Processing payment link expired event");

    const linkId = payload.payment_link.entity.id;
    console.log(`   Link ID: ${linkId}`);

    const updateQuery = `
      UPDATE payments
      SET status = 'expired', updated_at = NOW()
      WHERE razorpay_payment_link_id = $1
      RETURNING id
    `;

    await masterModel.customSelectSqlQuery2(updateQuery, [linkId]);

    console.log(`   ✅ Payment link marked as expired`);

    await logPaymentAction(null, linkId, "expired", {
      reason: "Link expiry time reached",
    });

    console.log("✅ Payment link expired event processed successfully\n");
  } catch (error) {
    console.error("❌ Error handling payment.link.expired:", error);
  }
};

/**
 * Handle payment.link.cancelled event
 */
const handlePaymentLinkCancelled = async (payload) => {
  try {
    console.log("❌ Processing payment link cancelled event");

    const linkId = payload.payment_link.entity.id;
    console.log(`   Link ID: ${linkId}`);

    const updateQuery = `
      UPDATE payments
      SET status = 'failed', updated_at = NOW()
      WHERE razorpay_payment_link_id = $1
      RETURNING id
    `;

    await masterModel.customSelectSqlQuery2(updateQuery, [linkId]);

    console.log(`   ✅ Payment link marked as failed`);

    await logPaymentAction(null, linkId, "failed", {
      reason: "Link cancelled by merchant or user",
    });

    console.log("✅ Payment link cancelled event processed successfully\n");
  } catch (error) {
    console.error("❌ Error handling payment.link.cancelled:", error);
  }
};

/**
 * Helper: Log Payment Action to Audit Table
 */
const logPaymentAction = async (
  subscriptionId,
  linkId,
  action,
  details = {}
) => {
  try {
    const logQuery = `
      INSERT INTO payment_links_audit 
      (subscription_id, razorpay_link_id, action, details, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id
    `;

    await masterModel.customSelectSqlQuery2(logQuery, [
      subscriptionId,
      linkId,
      action,
      JSON.stringify(details),
    ]);
  } catch (error) {
    console.error("Error logging payment action:", error);
  }
};

/**
 * Get Checkout Details for In-App Checkout Page
 * GET /api/v1/payments/checkout-details/:subscriptionId
 */
const getCheckoutDetails = async (req, reply) => {
  try {
    const { subscriptionId } = req.params;

    const query = `
      SELECT 
        s.id,
        s.client_id,
        s.device_plan_id,
        s.device_count,
        s.description,
        s.start_date,
        s.end_date,
        s.duration_days,
        s.price,
        s.status,
        c.company_name,
        c.contact_person,
        c.email,
        c.phone,
        COALESCE(dp.plan_name, 'IoT Blitz Plan') AS plan_name
      FROM subscriptions s
      JOIN client_info c ON s.client_id = c.id
      LEFT JOIN (
        SELECT DISTINCT ON (plan_name) plan_name 
        FROM device_plan_devices
      ) dp ON TRUE
      WHERE s.id = $1 OR s.client_id = (SELECT client_id FROM subscriptions WHERE id = $1 LIMIT 1)
      ORDER BY s.id DESC
      LIMIT 1
    `;

    const result = await masterModel.customSelectSqlQuery2(query, [subscriptionId]);

    if (!result || result.length === 0) {
      return reply.code(404).send({
        success: false,
        message: "Subscription checkout details not found",
      });
    }

    const subscription = result[0];

    reply.send({
      success: true,
      subscription: {
        id: subscription.id,
        client_id: subscription.client_id,
        company_name: subscription.company_name,
        contact_person: subscription.contact_person,
        email: subscription.email,
        phone: subscription.phone,
        plan_name: subscription.plan_name || "IoT Plan",
        device_count: subscription.device_count || 1,
        description: subscription.description,
        price: subscription.price,
        duration_days: subscription.duration_days || 30,
        start_date: subscription.start_date,
        end_date: subscription.end_date,
        status: subscription.status,
      },
      keyId: process.env.RAZORPAY_KEY_ID || "",
    });
  } catch (error) {
    console.error("Error in getCheckoutDetails:", error);
    reply.code(500).send({
      success: false,
      message: error.message || "Failed to fetch checkout details",
    });
  }
};

/**
 * Create Razorpay Order for In-App Checkout Flow
 * POST /api/v1/payments/create-order/:subscriptionId
 */
const createCheckoutOrder = async (req, reply) => {
  try {
    const { subscriptionId } = req.params;

    if (!subscriptionId) {
      return reply.code(400).send({
        success: false,
        message: "Subscription ID is required",
      });
    }

    // Step 1: Fetch Subscription
    const subscriptionQuery = `
      SELECT 
        s.id,
        s.client_id,
        s.device_count,
        s.duration_days,
        s.price,
        s.status,
        c.company_name,
        c.contact_person,
        c.email,
        c.phone
      FROM subscriptions s
      JOIN client_info c ON s.client_id = c.id
      WHERE s.id = $1 OR s.client_id = (SELECT client_id FROM subscriptions WHERE id = $1 LIMIT 1)
      ORDER BY s.id DESC
      LIMIT 1
    `;

    const subResult = await masterModel.customSelectSqlQuery2(subscriptionQuery, [subscriptionId]);

    if (!subResult || subResult.length === 0) {
      return reply.code(404).send({
        success: false,
        message: "Subscription not found",
      });
    }

    const subscription = subResult[0];

    // Step 2: Create Razorpay Order
    const orderResult = await razorpayService.createOrder({
      subscription,
      amount: subscription.price,
    });

    if (!orderResult.success) {
      return reply.code(500).send({
        success: false,
        message: orderResult.error || "Failed to create Razorpay Order",
      });
    }

    const order = orderResult.order;

    // Step 3: Save to payments table
    const paymentInsertQuery = `
      INSERT INTO payments 
      (subscription_id, client_id, razorpay_payment_link_id, amount, currency, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id
    `;

    await masterModel.customSelectSqlQuery2(paymentInsertQuery, [
      subscriptionId,
      subscription.client_id,
      order.id,
      subscription.price,
      "INR",
      "created",
    ]);

    reply.send({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID || "",
      subscription: {
        id: subscription.id,
        price: subscription.price,
        company_name: subscription.company_name,
        contact_person: subscription.contact_person,
        email: subscription.email,
        phone: subscription.phone,
      },
    });
  } catch (error) {
    console.error("Error in createCheckoutOrder:", error);
    reply.code(500).send({
      success: false,
      message: error.message || "Failed to initiate payment order",
    });
  }
};

/**
 * Verify Payment Signature & Auto-Renew Subscription (In-App Direct Flow)
 * POST /api/v1/payments/verify-payment
 */
const verifyPayment = async (req, reply) => {
  try {
    const { subscriptionId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!subscriptionId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return reply.code(400).send({
        success: false,
        message: "All payment verification fields are required",
      });
    }

    // Step 1: Verify HMAC Signature
    const isValid = razorpayService.verifyPaymentSignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });

    if (!isValid) {
      console.error("❌ Invalid payment signature for order:", razorpay_order_id);
      return reply.code(400).send({
        success: false,
        message: "Invalid payment signature verification failed",
      });
    }

    console.log("✅ In-App Payment Signature verified successfully for payment:", razorpay_payment_id);

    // Step 2: Update Payment record in database strictly by order ID
    const updatePaymentQuery = `
      UPDATE payments
      SET 
        status = 'paid',
        razorpay_payment_id = $1,
        paid_at = NOW(),
        updated_at = NOW()
      WHERE razorpay_payment_link_id = $2
      RETURNING id
    `;

    await masterModel.customSelectSqlQuery2(updatePaymentQuery, [
      razorpay_payment_id,
      razorpay_order_id,
    ]);

    // Step 3: Fetch Subscription details to extend duration
    const subscriptionQuery = `
      SELECT 
        id,
        client_id,
        application_id,
        device_plan_id,
        device_count,
        description,
        start_date,
        end_date,
        duration_days,
        price,
        status,
        created_by 
      FROM subscriptions 
      WHERE id = $1
    `;

    const subResult = await masterModel.customSelectSqlQuery2(subscriptionQuery, [subscriptionId]);

    if (subResult && subResult.length > 0) {
      const sub = subResult[0];
      const durationDays = sub.duration_days || 30;

      const currentEndDate = new Date(sub.end_date);
      const today = new Date();
      let newStartDate = currentEndDate < today ? today : currentEndDate;

      const newEndDate = new Date(newStartDate);
      newEndDate.setDate(newEndDate.getDate() + durationDays);

      const newStartDateStr = newStartDate.toISOString().split("T")[0];
      const newEndDateStr = newEndDate.toISOString().split("T")[0];

      // Mark previous subscription record as expired
      await masterModel.customSelectSqlQuery2(
        `UPDATE subscriptions SET status = 'expired'::subscription_status, updated_at = NOW() WHERE id = $1`,
        [subscriptionId]
      );

      // Insert NEW Subscription record for this transaction
      const insertSubQuery = `
        INSERT INTO subscriptions (
          client_id,
          application_id,
          device_plan_id,
          device_count,
          description,
          start_date,
          end_date,
          status,
          created_by,
          duration_days,
          price,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::DATE, $7::DATE, 'active'::subscription_status, $8, $9, $10, NOW(), NOW())
        RETURNING *
      `;

      const newSubResult = await masterModel.customSelectSqlQuery2(insertSubQuery, [
        sub.client_id,
        sub.application_id || null,
        sub.device_plan_id || null,
        sub.device_count || 1,
        sub.description || `In-app transaction renewal for subscription #${subscriptionId}`,
        newStartDateStr,
        newEndDateStr,
        sub.created_by || 1,
        durationDays,
        sub.price != null ? Number(sub.price) : 0,
      ]);

      const newSub = newSubResult[0];

      console.log(`✅ New Subscription record #${newSub.id} inserted for transaction (Valid until ${newEndDateStr})`);

      // Insert completed transaction into transactions table
      try {
        const insertTxQuery = `
          INSERT INTO transactions (
            transaction_id,
            order_id,
            subscription_id,
            client_id,
            amount,
            currency,
            payment_method,
            status,
            payment_signature,
            paid_at,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'paid', $8, NOW(), NOW())
          ON CONFLICT (transaction_id) DO NOTHING
          RETURNING id
        `;

        await masterModel.customSelectSqlQuery2(insertTxQuery, [
          razorpay_payment_id,
          razorpay_order_id,
          newSub ? newSub.id : subscriptionId,
          sub.client_id,
          sub.price != null ? Number(sub.price) : 0,
          "INR",
          "razorpay",
          razorpay_signature,
        ]);
        console.log(`✅ Clean transaction record saved to public.transactions table`);
      } catch (txErr) {
        console.error("Warning: Failed to insert into transactions table:", txErr.message);
      }

      // Log Audit Action
      await logPaymentAction(newSub.id, razorpay_order_id, "paid", {
        payment_id: razorpay_payment_id,
        old_subscription_id: subscriptionId,
        new_end_date: newEndDateStr,
        in_app_direct: true,
      });
    }

    reply.send({
      success: true,
      message: "Payment verified successfully! Subscription activated/renewed.",
      payment_id: razorpay_payment_id,
    });
  } catch (error) {
    console.error("Error in verifyPayment:", error);
    reply.code(500).send({
      success: false,
      message: error.message || "Failed to verify payment",
    });
  }
};

/**
 * Get All Payments across all subscriptions
 * GET /api/v1/payments/all
 */
const getAllPayments = async (req, reply) => {
  try {
    console.log("📋 Fetching all payments records from transactions table...");

    const query = `
      SELECT 
        t.id,
        t.subscription_id,
        t.client_id,
        t.order_id AS razorpay_payment_link_id,
        t.transaction_id AS razorpay_payment_id,
        t.amount,
        t.currency,
        NULL AS payment_link_url,
        t.status,
        NULL AS expiry_date,
        t.paid_at,
        t.created_at,
        t.created_at AS updated_at,
        c.company_name,
        c.contact_person,
        c.email AS client_email,
        c.phone AS client_phone
      FROM transactions t
      LEFT JOIN client_info c ON c.id = t.client_id

      UNION ALL

      SELECT 
        p.id,
        p.subscription_id,
        p.client_id,
        p.razorpay_payment_link_id,
        p.razorpay_payment_id,
        p.amount,
        p.currency,
        p.payment_link_url,
        p.status,
        p.expiry_date,
        p.paid_at,
        p.created_at,
        p.updated_at,
        c.company_name,
        c.contact_person,
        c.email AS client_email,
        c.phone AS client_phone
      FROM payments p
      LEFT JOIN client_info c ON c.id = p.client_id
      WHERE p.status IN ('created', 'expired', 'failed')
      AND NOT EXISTS (
        SELECT 1 FROM transactions t2 
        WHERE t2.order_id = p.razorpay_payment_link_id 
           OR t2.transaction_id = p.razorpay_payment_id
      )

      ORDER BY created_at DESC
    `;

    const payments = await masterModel.customSelectSqlQuery2(query);

    reply.send({
      success: true,
      payments: payments || [],
      total: payments?.length || 0,
    });
  } catch (error) {
    console.error("❌ Error fetching all payments:", error);
    reply.code(500).send({
      success: false,
      message: error.message || "Failed to fetch payments",
    });
  }
};

module.exports = {
  generatePaymentLinkForSubscription,
  getPaymentsBySubscription,
  handleRazorpayWebhook,
  getCheckoutDetails,
  createCheckoutOrder,
  verifyPayment,
  getAllPayments,
};

