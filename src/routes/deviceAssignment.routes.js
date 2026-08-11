const assignmentController = require("../controllers/deviceAssignment.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const rbac = require("../middlewares/rbac.middleware");

async function deviceAssignmentRoutes(fastify) {
  fastify.post("/assine-device-to-client", {
    preHandler: [authMiddleware, rbac(["super_admin", "admin"])],
    handler: assignmentController.assignDevice,
  });

  fastify.patch("/unassinedevice/:id/unassign", {
    preHandler: [authMiddleware, rbac(["super_admin", "admin"])],
    handler: assignmentController.unassignDevice,
  });

  fastify.get("/getall-assingend-to-users", {
    preHandler: [authMiddleware],
    handler: assignmentController.getAllAssignments,
  });

  fastify.get("/client/:clientId", {
    preHandler: [authMiddleware],
    handler: assignmentController.getAssignmentsByClient,
  });
}

module.exports = deviceAssignmentRoutes;