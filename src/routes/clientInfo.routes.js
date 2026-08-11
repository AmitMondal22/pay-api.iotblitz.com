const clientController = require("../controllers/clientInfo.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const rbac = require("../middlewares/rbac.middleware");

async function clientInfoRoutes(fastify) {
  fastify.post("/create-client", 
    {
    preHandler: [authMiddleware, rbac(["super_admin", "admin"])],


    handler: clientController.createClient,
  });

  fastify.get("/get-all-client", {
    preHandler: [authMiddleware],
    handler: clientController.getAllClients,
  });

  fastify.get("/get-client-by/:id", {
    preHandler: [authMiddleware],
    handler: clientController.getClientById,
  });

  fastify.post("/update-client-by/:id", {
    preHandler: [authMiddleware, rbac(["super_admin", "admin"])],
    handler: clientController.updateClient,
  });

  fastify.delete("/delete-client/:id", {
    preHandler: [authMiddleware, rbac(["super_admin"])],
    handler: clientController.deleteClient,
  });
}

module.exports = clientInfoRoutes;