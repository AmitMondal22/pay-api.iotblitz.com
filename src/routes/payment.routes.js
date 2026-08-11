const paymentController = require("../controllers/payment.controller");

async function paymentRoutes(fastify, options) {
  // Generate Payment Link for Subscription
  fastify.post(
    "/generate-link/:subscriptionId",
    paymentController.generatePaymentLinkForSubscription
  );

  // Get Payment History for Subscription
  fastify.get(
    "/subscription/:subscriptionId",
    paymentController.getPaymentsBySubscription
  );

  // Razorpay Webhook Handler (Public endpoint - no authentication required)
  fastify.post(
    "/razorpay-webhook",
    paymentController.handleRazorpayWebhook
  );

  // Get In-App Checkout details
  fastify.get(
    "/checkout-details/:subscriptionId",
    paymentController.getCheckoutDetails
  );

  // Create Razorpay Order for In-App Checkout
  fastify.post(
    "/create-order/:subscriptionId",
    paymentController.createCheckoutOrder
  );

  // Verify Payment Signature after checkout popup
  fastify.post(
    "/verify-payment",
    paymentController.verifyPayment
  );

  // Get All Payment Transactions across system
  fastify.get(
    "/all",
    paymentController.getAllPayments
  );

  // Verify Device Access & Subscription Validity by Device UID
  const deviceController = require("../controllers/device.controller");
  fastify.post("/verify-device-access", deviceController.verifyDeviceAccess);
  fastify.get("/verify-device-access/:deviceUid", deviceController.verifyDeviceAccess);
}

module.exports = paymentRoutes;
