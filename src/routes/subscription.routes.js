const subscriptionController = require("../controllers/subscription.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const rbac = require("../middlewares/rbac.middleware");

async function subscriptionRoutes(fastify) {
  fastify.post("/create-subscription", {
    preHandler: [authMiddleware, rbac(["super_admin", "admin"])],
    handler: subscriptionController.createSubscription,
  });

  fastify.get("/get-all-subscriptions", {
    preHandler: [authMiddleware],
    handler: subscriptionController.getAllSubscriptions,
  });

  fastify.get("/get-subscription-by-id/:id", {
    preHandler: [authMiddleware],
    handler: subscriptionController.getSubscriptionById,
  });

  fastify.put("/update-subscription/:id", {
    preHandler: [authMiddleware, rbac(["super_admin", "admin"])],
    handler: subscriptionController.updateSubscription,
  });

  fastify.post("/update-subscription/:id", {
    preHandler: [authMiddleware, rbac(["super_admin", "admin"])],
    handler: subscriptionController.updateSubscription,
  });


  fastify.delete("/delete-subscription/:id", {
    preHandler: [authMiddleware, rbac(["super_admin", "admin"])],
    handler: subscriptionController.deleteSubscription,
  });

  fastify.get("/getallsubscriptions/client/:clientId", {
    preHandler: [authMiddleware],
    handler: subscriptionController.getSubscriptionsByClient,
  });

  fastify.get("/getallsubscriptions/application/:applicationId", {
    preHandler: [authMiddleware],
    handler: subscriptionController.getSubscriptionsByApplication,
  });

  fastify.patch("/update-subscription/:id/status", {
    preHandler: [authMiddleware, rbac(["super_admin", "admin"])],
    handler: subscriptionController.updateSubscriptionStatus,
  });

  fastify.patch("/re-new-subscription/:id/renew", {
    preHandler: [authMiddleware, rbac(["super_admin", "admin"])],
    handler: subscriptionController.renewSubscription,
  });
}

module.exports = subscriptionRoutes;