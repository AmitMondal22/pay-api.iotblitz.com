function rbac(allowedRoles = []) {
  return async (request, reply) => {
    const userRole = request.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      reply.status(403).send({ success: false, message: "Forbidden: insufficient role" });
    }
  };
}

module.exports = rbac;