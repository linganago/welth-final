/**
 * Application error hierarchy.
 *
 * All errors thrown from server actions should be one of these typed classes.
 * The `createAction` wrapper in lib/action-client.js catches them and returns
 * a structured `{ success: false, error }` payload instead of an uncaught
 * exception, so the client always receives a consistent shape.
 */

export class AppError extends Error {
  /**
   * @param {string} message   Human-readable message shown to the user.
   * @param {string} code      Machine-readable constant (SCREAMING_SNAKE_CASE).
   * @param {number} statusCode  HTTP-equivalent status (400, 401, 404, 429…).
   */
  constructor(message, code = "APP_ERROR", statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "You must be signed in to perform this action.") {
    super(message, "UNAUTHORIZED", 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super(message, "FORBIDDEN", 403);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  /**
   * @param {string} resource  E.g. "Transaction", "Account"
   */
  constructor(resource = "Resource") {
    super(`${resource} not found.`, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  /**
   * @param {string} message  Specific field-level or form-level message.
   */
  constructor(message) {
    super(message, "VALIDATION_ERROR", 422);
    this.name = "ValidationError";
  }
}

export class RateLimitError extends AppError {
  /**
   * @param {number} resetInSeconds  Seconds until the bucket refills.
   */
  constructor(resetInSeconds = 60) {
    super(
      `Too many requests. Please try again in ${resetInSeconds} second${
        resetInSeconds === 1 ? "" : "s"
      }.`,
      "RATE_LIMIT_EXCEEDED",
      429
    );
    this.name = "RateLimitError";
    this.resetInSeconds = resetInSeconds;
  }
}

export class ConflictError extends AppError {
  constructor(message = "This request conflicts with existing data.") {
    super(message, "CONFLICT", 409);
    this.name = "ConflictError";
  }
}

export class InternalError extends AppError {
  constructor(message = "An unexpected error occurred. Please try again.") {
    super(message, "INTERNAL_ERROR", 500);
    this.name = "InternalError";
  }
}

/**
 * Wraps any unknown thrown value into a typed AppError.
 * Prisma errors, network errors, etc. all get normalised.
 *
 * @param {unknown} err
 * @returns {AppError}
 */
export function normaliseError(err) {
  if (err instanceof AppError) return err;

  if (err instanceof Error) {
    // Prisma unique-constraint violation → ConflictError
    if (err.code === "P2002") {
      return new ConflictError(
        "A record with this data already exists."
      );
    }
    // Prisma record-not-found
    if (err.code === "P2025") {
      return new NotFoundError("Record");
    }
    return new AppError(err.message, "UNKNOWN_ERROR", 500);
  }

  return new InternalError();
}
