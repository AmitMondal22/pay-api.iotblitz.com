const fastify = require("fastify")({ logger: true });
require("dotenv").config();

// ── Plugins ──────────────────────────────
fastify.register(require("@fastify/cors"), {
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

fastify.register(require("@fastify/helmet"));
fastify.register(require("@fastify/sensible"));
fastify.register(require("@fastify/jwt"), { secret: process.env.JWT_SECRET });
fastify.register(require("@fastify/rate-limit"), { max: 100, timeWindow: "1 minute" });

// ── Swagger (API docs) ──────────────────────────────
fastify.register(require("@fastify/swagger"), {
  swagger: {
    info: {
      title: "IoT Payment Gateway API",
      description: "API documentation for iot_payment_db",
      version: "1.0.0",
    },
  },
});
fastify.register(require("@fastify/swagger-ui"), { routePrefix: "/docs" });

// ── Health check ──────────────────────────────
fastify.get("/health", async () => ({
  status: "ok",
  timestamp: new Date().toISOString(),
}));

// ── Routes (versioned, one register per resource) ──────────────────────────────
fastify.register(require("./src/routes/auth.routes"), { prefix: "/api/v1/auth" });
fastify.register(require("./src/routes/clientInfo.routes"), { prefix: "/api/v1/clients" });
fastify.register(require("./src/routes/device.routes"), { prefix: "/api/v1/devices" });
fastify.register(require("./src/routes/deviceAssignment.routes"), { prefix: "/api/v1/device-assignments" });
fastify.register(require("./src/routes/subscription.routes"), { prefix: "/api/v1/subscriptions" });
fastify.register(require("./src/routes/application.routes"), { prefix: "/api/v1/application" });
fastify.register(require("./src/routes/plans.routes"), { prefix: "/api/v1/device-plan" });
fastify.register(require("./src/routes/payment.routes"), { prefix: "/api/v1/payments" });

// ── Global error handler ──────────────────────────────
fastify.setErrorHandler(require("./src/middlewares/errorHandler"));

// ── Start server ──────────────────────────────
const { initSubscriptionExpiryCron } = require("./src/jobs/subscriptionExpiryCron");

const start = async () => {
  try {
    const port = process.env.PORT || 4000;
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📚 API docs available at http://localhost:${port}/docs`);

    // Initialize automated subscription expiry cron job
    initSubscriptionExpiryCron();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();