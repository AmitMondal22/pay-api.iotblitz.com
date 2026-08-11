const applicationController = require("../controllers/application.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const rbac = require("../middlewares/rbac.middleware");




async function applicationRoutes(fastify, options) {

  fastify.post("/applications",{

        preHandler: [authMiddleware],

    handler: applicationController.createApplication});

  fastify.get("/applications",{ preHandler: [authMiddleware] ,handler:applicationController.getAllApplications});

  fastify.get("/applications/:id",{preHandler: [authMiddleware] , handler:applicationController.getApplicationById});

  fastify.post("/applications/:id", {preHandler: [authMiddleware], handler:applicationController.updateApplication});

  fastify.post("/applications/:id/status", {preHandler: [authMiddleware], handler:applicationController.updateApplicationStatus});

  fastify.delete("/applications/:id", {preHandler: [authMiddleware], handler:applicationController.deleteApplication});

}

module.exports = applicationRoutes;


