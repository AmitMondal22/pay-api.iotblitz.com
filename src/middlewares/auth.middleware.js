async function authMiddleware(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ success: false, message: "Unauthorized" });
  }
}

module.exports = authMiddleware;