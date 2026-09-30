const ApiError = require("../utils/ApiError");

function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  // Mongoose duplicate key (e.g. duplicate email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    error = ApiError.validation(`Duplicate value for ${field}`, [
      { field, message: `${field} already in use` },
    ]);
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    error = ApiError.validation("Validation failed", details);
  }

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    error = ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
  }

  const statusCode = error.statusCode || 500;
  const payload = {
    error: {
      message: error.message || "Internal server error",
    },
  };
  if (error.details) payload.error.details = error.details;
  if (process.env.NODE_ENV !== "production" && statusCode === 500) {
    payload.error.stack = err.stack;
  }
  if (statusCode === 500) {
    console.error("[error]", err);
  }

  res.status(statusCode).json(payload);
}

module.exports = { notFoundHandler, errorHandler };
