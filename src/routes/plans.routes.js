// const controller = require("../controllers/plansForAssingDevice.controller");

// async function devicePlanDevicesRoutes(fastify, options) {
//   fastify.post("/device-plans", controller.createDevicePlan);              // bulk create
//   fastify.post("/device-plans/add-devices", controller.addDevicesToPlan);  // bulk add to existing plan

//   fastify.get("/device-plans", controller.getAllDevicePlanDevices);        // flat list
//   fastify.get("/device-plans/grouped", controller.getAllDevicePlansGrouped); // grouped by plan
//   fastify.get("/device-plans/plan/:planName", controller.getDevicesByPlanName);
//   fastify.get("/device-plans/:id", controller.getDevicePlanById);

//   fastify.put("/device-plans/plan/:planName", controller.updatePlanDetails);
//   fastify.put("/device-plans/:id", controller.updateDeviceInPlan);

//   fastify.delete("/device-plans/:id", controller.removeDeviceFromPlan);
//   fastify.delete("/device-plans/bulk", controller.bulkRemoveDevicesFromPlan);
//   fastify.delete("/device-plans/plan/:planName", controller.deleteEntirePlan);
// }

// module.exports = devicePlanDevicesRoutes;




/////////////////////////////////////////////////////////////////










const controller = require("../controllers/plansForAssingDevice.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const rbac = require("../middlewares/rbac.middleware");

async function devicePlanDevicesRoutes(fastify, options) {
  // Create
  fastify.post("/device-plans", {
    preHandler: [authMiddleware],
    handler: controller.createDevicePlan,
  });

  // Add devices to existing plan
  fastify.post("/device-plans/add-devices", {
    preHandler: [authMiddleware],
    handler: controller.addDevicesToPlan,
  });

  // Get all
  fastify.get("/device-plans", {
    preHandler: [authMiddleware],
    handler: controller.getAllDevicePlanDevices,
  });

  // Get grouped plans
  fastify.get("/device-plans/grouped", {
    preHandler: [authMiddleware],
    handler: controller.getAllDevicePlansGrouped,
  });

  // Get devices by plan name
  fastify.get("/device-plans/plan/:planName", {
    preHandler: [authMiddleware],
    handler: controller.getDevicesByPlanName,
  });

  // Get device plan by ID
  fastify.get("/device-plans/:id", {
    preHandler: [authMiddleware],
    handler: controller.getDevicePlanById,
  });

  // Update plan details
  fastify.post("/device-plans/plan/:planName", {
    preHandler: [authMiddleware],
    handler: controller.updatePlanDetails,
  });

  // Update device in plan
  fastify.post("/device-plans/:id", {
    preHandler: [authMiddleware],
    handler: controller.updateDeviceInPlan,
  });

  // Remove device from plan
  fastify.delete("/device-plans/:id", {
    preHandler: [authMiddleware],
    handler: controller.removeDeviceFromPlan,
  });

  // Bulk remove devices
  fastify.delete("/device-plans/bulk", {
    preHandler: [authMiddleware],
    handler: controller.bulkRemoveDevicesFromPlan,
  });

  // Delete entire plan
  fastify.delete("/device-plans/plan/:planName", {
    preHandler: [authMiddleware],
    handler: controller.deleteEntirePlan,
  });
}

module.exports = devicePlanDevicesRoutes;