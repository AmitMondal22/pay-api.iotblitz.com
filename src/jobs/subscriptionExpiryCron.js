const cron = require("node-cron");
const masterModel = require("../models/masterModel");
const razorpayService = require("../services/razorpay.service");

/**
 * Check and process expired subscriptions, generating Razorpay payment links
 */
const processExpiredSubscriptions = async () => {
  console.log("\n⏰ [Cron Job] Running automated subscription expiry check...");

  try {
    // ===== STEP 1: Fetch subscriptions that are expired or expiring today =====
    const expiredQuery = `
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
        c.phone
      FROM subscriptions s
      JOIN client_info c ON s.client_id = c.id
      WHERE s.end_date <= CURRENT_DATE 
      AND s.status IN ('active'::subscription_status, 'expired'::subscription_status)
    `;

    const expiredSubs = await masterModel.customSelectSqlQuery2(expiredQuery, []);

    if (!expiredSubs || expiredSubs.length === 0) {
      console.log("   No expired subscriptions found today.");
      return;
    }

    console.log(`   Found ${expiredSubs.length} subscription(s) reaching expiry.`);

    for (const sub of expiredSubs) {
      console.log(`\n   Processing Subscription #${sub.id} (Client: ${sub.company_name})...`);

      // Mark as expired if still marked active
      if (sub.status === "active") {
        await masterModel.customSelectSqlQuery2(
          `UPDATE subscriptions SET status = 'expired'::subscription_status, updated_at = NOW() WHERE id = $1`,
          [sub.id]
        );
        console.log(`   Updated status to 'expired' for Subscription #${sub.id}`);
      }

      // Check if recent payment link already generated
      const recentLinkQuery = `
        SELECT id, razorpay_payment_link_id, payment_link_url, status
        FROM payments
        WHERE subscription_id = $1
        AND status IN ('created', 'paid')
        AND created_at > NOW() - INTERVAL '3 days'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const recentLinks = await masterModel.customSelectSqlQuery2(recentLinkQuery, [sub.id]);

      if (recentLinks && recentLinks.length > 0) {
        console.log(`   Recent payment link already exists for Subscription #${sub.id}. Skipping link generation.`);
        continue;
      }

      if (!sub.price || Number(sub.price) <= 0) {
        console.log(`   Subscription #${sub.id} has 0 price. Skipping Razorpay link generation.`);
        continue;
      }

      // Generate Razorpay Payment Link
      console.log(`   Generating Razorpay payment link for ₹${sub.price}...`);
      const clientObj = {
        company_name: sub.company_name,
        contact_person: sub.contact_person,
        email: sub.email,
        phone: sub.phone,
      };

      const linkResult = await razorpayService.createPaymentLink({
        subscription: sub,
        client: clientObj,
        amount: sub.price,
        description: `Automated Renewal - Subscription ID: ${sub.id}`,
      });

      if (linkResult.success && linkResult.paymentLink) {
        const linkData = linkResult.paymentLink;

        // Save to payments table
        const insertPaymentQuery = `
          INSERT INTO payments 
          (subscription_id, client_id, razorpay_payment_link_id, amount, currency, payment_link_url, status, expiry_date, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          RETURNING id
        `;

        await masterModel.customSelectSqlQuery2(insertPaymentQuery, [
          sub.id,
          sub.client_id,
          linkData.id,
          sub.price,
          "INR",
          linkResult.url,
          "created",
          linkData.expire_by ? new Date(linkData.expire_by * 1000) : null,
        ]);

        // Audit log
        await masterModel.customSelectSqlQuery2(
          `INSERT INTO payment_links_audit (subscription_id, razorpay_link_id, action, details, created_at) VALUES ($1, $2, $3, $4, NOW())`,
          [sub.id, linkData.id, "created", JSON.stringify({ amount: sub.price, automated: true })]
        );

        console.log(`   ✅ Automated payment link created & saved for Subscription #${sub.id}`);
      } else {
        console.error(`   ❌ Failed to create Razorpay link for Subscription #${sub.id}:`, linkResult.error);
      }
    }
  } catch (error) {
    console.error("❌ Error in processExpiredSubscriptions cron job:", error);
  }
};

/**
 * Initialize daily Cron Job
 */
const initSubscriptionExpiryCron = () => {
  // Run daily at midnight (00:00)
  cron.schedule("0 0 * * *", () => {
    processExpiredSubscriptions();
  });
  console.log("⏰ Daily Subscription Expiry Cron Job initialized (00:00).");
};

module.exports = {
  initSubscriptionExpiryCron,
  processExpiredSubscriptions,
};
