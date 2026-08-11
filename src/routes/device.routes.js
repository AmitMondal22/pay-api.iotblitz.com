const deviceController = require("../controllers/device.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const rbac = require("../middlewares/rbac.middleware");

async function deviceRoutes(fastify) {
  fastify.post("/createdevice", {
    preHandler: [authMiddleware, rbac(["super_admin", "admin"])],
    handler: deviceController.createDevice,
  });

  fastify.get("/getalldevices", {
    // preHandler: [authMiddleware],
    handler: deviceController.getAllDevices,
  });

  fastify.get("/getdevice-by-id/:id", {
    preHandler: [authMiddleware],
    handler: deviceController.getDeviceById,
  });

  fastify.post("/update-device/:id/status", {
    preHandler: [authMiddleware, rbac(["super_admin", "admin", "manager"])],
    handler: deviceController.updateDeviceStatus,
  });

  fastify.delete("/delete-device/:id", {
    preHandler: [authMiddleware, rbac(["super_admin"])],
    handler: deviceController.deleteDevice,
  });

  // Verify Device Validity & Access by Device UID
  fastify.post("/verify-access", {
    handler: deviceController.verifyDeviceAccess,
  });

  fastify.get("/verify-access/:deviceUid", {
    handler: deviceController.verifyDeviceAccess,
  });
}

module.exports = deviceRoutes;