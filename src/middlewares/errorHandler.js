function errorHandler(error, request, reply) {
  request.log.error(error);

  const statusCode = error.statusCode || 500;
  reply.status(statusCode).send({
    success: false,
    message: error.message || "Internal Server Error",
  });
}

module.exports = errorHandler;