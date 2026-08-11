const authController = require("../controllers/auth.controller");

async function authRoutes(fastify) {


  fastify.post("/login", authController.login);


  fastify.post("/register", authController.register);
}

module.exports = authRoutes;