import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/cache before importing the module under test
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn, _key, _opts) => fn), // pass-through in tests
}));

import { revalidateTag } from "next/cache";
import {
  tags,
  revalidateUserCache,
  revalidateTransactionCache,
  revalidateAccountCache,
} from "@/lib/cache";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tags", () => {
  it("generates user tag", () => {
    expect(tags.user("u1")).toBe("user-u1");
  });
  it("generates accounts tag", () => {
    expect(tags.accounts("u1")).toBe("accounts-u1");
  });
  it("generates transactions tag", () => {
    expect(tags.transactions("u1")).toBe("transactions-u1");
  });
  it("generates dashboard tag", () => {
    expect(tags.dashboard("u1")).toBe("dashboard-u1");
  });
  it("generates budget tag", () => {
    expect(tags.budget("u1")).toBe("budget-u1");
  });
});

describe("revalidateUserCache", () => {
  it("invalidates all 5 tags for the user", () => {
    revalidateUserCache("user-abc");

    expect(revalidateTag).toHaveBeenCalledWith("user-user-abc");
    expect(revalidateTag).toHaveBeenCalledWith("accounts-user-abc");
    expect(revalidateTag).toHaveBeenCalledWith("transactions-user-abc");
    expect(revalidateTag).toHaveBeenCalledWith("dashboard-user-abc");
    expect(revalidateTag).toHaveBeenCalledWith("budget-user-abc");
    expect(revalidateTag).toHaveBeenCalledTimes(5);
  });
});

describe("revalidateTransactionCache", () => {
  it("invalidates transactions and dashboard tags only", () => {
    revalidateTransactionCache("user-abc");

    expect(revalidateTag).toHaveBeenCalledWith("transactions-user-abc");
    expect(revalidateTag).toHaveBeenCalledWith("dashboard-user-abc");
    expect(revalidateTag).toHaveBeenCalledTimes(2);

    // Should NOT invalidate accounts or budget
    expect(revalidateTag).not.toHaveBeenCalledWith("accounts-user-abc");
    expect(revalidateTag).not.toHaveBeenCalledWith("budget-user-abc");
  });
});

describe("revalidateAccountCache", () => {
  it("invalidates accounts and dashboard tags only", () => {
    revalidateAccountCache("user-abc");

    expect(revalidateTag).toHaveBeenCalledWith("accounts-user-abc");
    expect(revalidateTag).toHaveBeenCalledWith("dashboard-user-abc");
    expect(revalidateTag).toHaveBeenCalledTimes(2);
  });
});
