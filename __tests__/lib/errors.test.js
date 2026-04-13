import { describe, it, expect } from "vitest";
import {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  ConflictError,
  InternalError,
  normaliseError,
} from "@/lib/errors";

describe("AppError", () => {
  it("stores message, code and statusCode", () => {
    const err = new AppError("Something broke", "BROKE", 500);
    expect(err.message).toBe("Something broke");
    expect(err.code).toBe("BROKE");
    expect(err.statusCode).toBe(500);
    expect(err).toBeInstanceOf(Error);
  });

  it("defaults statusCode to 400", () => {
    const err = new AppError("bad", "BAD");
    expect(err.statusCode).toBe(400);
  });
});

describe("UnauthorizedError", () => {
  it("has UNAUTHORIZED code and 401 status", () => {
    const err = new UnauthorizedError();
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.statusCode).toBe(401);
    expect(err).toBeInstanceOf(AppError);
  });

  it("accepts a custom message", () => {
    const err = new UnauthorizedError("Token expired");
    expect(err.message).toBe("Token expired");
  });
});

describe("ForbiddenError", () => {
  it("has FORBIDDEN code and 403 status", () => {
    const err = new ForbiddenError();
    expect(err.code).toBe("FORBIDDEN");
    expect(err.statusCode).toBe(403);
  });
});

describe("NotFoundError", () => {
  it("interpolates the resource name", () => {
    const err = new NotFoundError("Transaction");
    expect(err.message).toBe("Transaction not found.");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.statusCode).toBe(404);
  });

  it("defaults to 'Resource' when no name given", () => {
    const err = new NotFoundError();
    expect(err.message).toBe("Resource not found.");
  });
});

describe("ValidationError", () => {
  it("has VALIDATION_ERROR code and 422 status", () => {
    const err = new ValidationError("Amount is required");
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.statusCode).toBe(422);
    expect(err.message).toBe("Amount is required");
  });
});

describe("RateLimitError", () => {
  it("interpolates reset seconds into message", () => {
    const err = new RateLimitError(30);
    expect(err.message).toContain("30 seconds");
    expect(err.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(err.statusCode).toBe(429);
    expect(err.resetInSeconds).toBe(30);
  });

  it("handles singular 'second'", () => {
    const err = new RateLimitError(1);
    expect(err.message).toContain("1 second");
    expect(err.message).not.toContain("seconds");
  });
});

describe("ConflictError", () => {
  it("has CONFLICT code and 409 status", () => {
    const err = new ConflictError();
    expect(err.code).toBe("CONFLICT");
    expect(err.statusCode).toBe(409);
  });
});

describe("InternalError", () => {
  it("has INTERNAL_ERROR code and 500 status", () => {
    const err = new InternalError();
    expect(err.code).toBe("INTERNAL_ERROR");
    expect(err.statusCode).toBe(500);
  });
});

describe("normaliseError", () => {
  it("returns the same AppError instance unchanged", () => {
    const original = new ValidationError("bad input");
    const result = normaliseError(original);
    expect(result).toBe(original);
  });

  it("wraps a plain Error in an AppError", () => {
    const plain = new Error("network timeout");
    const result = normaliseError(plain);
    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe("network timeout");
    expect(result.code).toBe("UNKNOWN_ERROR");
  });

  it("maps Prisma P2002 (unique constraint) to ConflictError", () => {
    const prismaErr = new Error("Unique constraint failed");
    prismaErr.code = "P2002";
    const result = normaliseError(prismaErr);
    expect(result).toBeInstanceOf(ConflictError);
    expect(result.statusCode).toBe(409);
  });

  it("maps Prisma P2025 (record not found) to NotFoundError", () => {
    const prismaErr = new Error("Record to update not found.");
    prismaErr.code = "P2025";
    const result = normaliseError(prismaErr);
    expect(result).toBeInstanceOf(NotFoundError);
    expect(result.statusCode).toBe(404);
  });

  it("wraps a non-Error thrown value in InternalError", () => {
    const result = normaliseError("something weird was thrown");
    expect(result).toBeInstanceOf(InternalError);
    expect(result.statusCode).toBe(500);
  });
});
