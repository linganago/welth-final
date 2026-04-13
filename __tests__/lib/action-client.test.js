import { describe, it, expect, vi } from "vitest";
import { createAction } from "@/lib/action-client";
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  InternalError,
} from "@/lib/errors";

describe("createAction", () => {
  it("returns { success: true, data } when the handler resolves", async () => {
    const handler = vi.fn().mockResolvedValue({ id: "123" });
    const action = createAction(handler);
    const result = await action("arg1", "arg2");

    expect(result).toEqual({ success: true, data: { id: "123" } });
    expect(handler).toHaveBeenCalledWith("arg1", "arg2");
  });

  it("returns { success: false, error } when the handler throws a ValidationError", async () => {
    const handler = vi.fn().mockRejectedValue(new ValidationError("Amount is required"));
    const action = createAction(handler);
    const result = await action();

    expect(result.success).toBe(false);
    expect(result.error.message).toBe("Amount is required");
    expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns { success: false, error } when the handler throws an UnauthorizedError", async () => {
    const handler = vi.fn().mockRejectedValue(new UnauthorizedError());
    const action = createAction(handler);
    const result = await action();

    expect(result.success).toBe(false);
    expect(result.error.code).toBe("UNAUTHORIZED");
    expect(result.error.message).toMatch(/signed in/i);
  });

  it("normalises an unexpected plain Error to UNKNOWN_ERROR", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("DB connection reset"));
    const action = createAction(handler);
    const result = await action();

    expect(result.success).toBe(false);
    expect(result.error.message).toBe("DB connection reset");
    expect(result.error.code).toBe("UNKNOWN_ERROR");
  });

  it("passes all arguments through to the handler", async () => {
    const handler = vi.fn().mockResolvedValue("ok");
    const action = createAction(handler);
    await action(1, 2, 3);
    expect(handler).toHaveBeenCalledWith(1, 2, 3);
  });

  it("never throws — always returns a structured result", async () => {
    const handler = vi.fn().mockRejectedValue("bare string thrown");
    const action = createAction(handler);
    await expect(action()).resolves.not.toThrow();
    const result = await action();
    expect(result.success).toBe(false);
  });
});
