const ApiError = require("../utils/ApiError");

/**
 * Returns an Express middleware that validates req.body (or req.query)
 * against a Zod schema, throwing a 422 ApiError with field details on failure.
 *
 * Usage: validate(signupSchema) or validate(schema, "query")
 */
function validate(schema, source = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return next(ApiError.validation("Validation failed", details));
    }
    req[source] = result.data;
    next();
  };
}

module.exports = validate;
