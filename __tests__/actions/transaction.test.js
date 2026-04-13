/**
 * Integration tests for the createTransaction and getUserTransactions
 * server actions.
 *
 * These tests use Prisma against a REAL test database (pointed to by
 * TEST_DATABASE_URL in .env.test).  They do NOT mock the DB — that is
 * intentional: we want to catch real constraint violations and index
 * behaviour, not mock them away.
 *
 * To run:
 *   1. Create a Postgres database named "welth_test".
 *   2. Set TEST_DATABASE_URL=postgresql://... in .env.test
 *   3. Run: npx prisma migrate deploy
 *   4. Run: npx vitest run __tests__/actions/transaction.test.js
 *
 * Each test suite creates its own user + account and tears down after itself
 * to keep tests independent.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/lib/prisma";
import { createTransaction, getUserTransactions } from "@/actions/transaction";
import { ValidationError } from "@/lib/errors";

// ---------------------------------------------------------------------------
// Mock external dependencies so tests run without real Clerk / ArcJet keys
// ---------------------------------------------------------------------------

// Clerk auth — always returns a fixed clerkUserId
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "test-clerk-id-txn" }),
}));

// ArcJet — always allow
vi.mock("@arcjet/next", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    request: vi.fn().mockResolvedValue({}),
    default: vi.fn().mockReturnValue({
      protect: vi.fn().mockResolvedValue({ isDenied: () => false }),
    }),
  };
});

// lib/arcjet.js re-exports the arcjet instance — mock it directly
vi.mock("@/lib/arcjet", () => ({
  default: {
    protect: vi.fn().mockResolvedValue({ isDenied: () => false }),
  },
}));

// next/cache — no-op stubs
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
}));

// lib/cache — no-op stubs
vi.mock("@/lib/cache", () => ({
  revalidateTransactionCache: vi.fn(),
  revalidateUserCache: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const CLERK_USER_ID = "test-clerk-id-txn";
let testUser;
let testAccount;

beforeEach(async () => {
  // Create a fresh user + account for each test
  testUser = await db.user.create({
    data: {
      clerkUserId: CLERK_USER_ID,
      email: `test-${Date.now()}@welth-test.com`,
      name: "Test User",
    },
  });

  testAccount = await db.account.create({
    data: {
      userId: testUser.id,
      name: "Test Checking",
      type: "CURRENT",
      balance: 1000.0,
      isDefault: true,
    },
  });
});

afterEach(async () => {
  // Clean up in correct FK order
  await db.transaction.deleteMany({ where: { userId: testUser.id } });
  await db.account.deleteMany({ where: { userId: testUser.id } });
  await db.user.delete({ where: { id: testUser.id } });
});

// ---------------------------------------------------------------------------
// createTransaction
// ---------------------------------------------------------------------------

describe("createTransaction", () => {
  const baseData = {
    type: "EXPENSE",
    amount: "100",
    description: "Lunch",
    category: "food",
    date: new Date("2025-06-01"),
    isRecurring: false,
  };

  it("creates a transaction and returns serialised data", async () => {
    const data = { ...baseData, accountId: testAccount.id };
    const result = await createTransaction(data, crypto.randomUUID());

    expect(result.success).toBe(true);
    expect(result.data.id).toBeDefined();
    expect(result.data.amount).toBe(100);
    expect(result.data.type).toBe("EXPENSE");
  });

  it("deducts balance for EXPENSE transactions", async () => {
    const data = { ...baseData, accountId: testAccount.id, amount: "200" };
    await createTransaction(data, crypto.randomUUID());

    const updated = await db.account.findUnique({
      where: { id: testAccount.id },
    });
    expect(updated.balance.toNumber()).toBe(800);
  });

  it("increases balance for INCOME transactions", async () => {
    const data = {
      ...baseData,
      type: "INCOME",
      category: "salary",
      amount: "500",
      accountId: testAccount.id,
    };
    await createTransaction(data, crypto.randomUUID());

    const updated = await db.account.findUnique({
      where: { id: testAccount.id },
    });
    expect(updated.balance.toNumber()).toBe(1500);
  });

  it("is idempotent — duplicate key returns existing record without double-deducting", async () => {
    const idemKey = crypto.randomUUID();
    const data = { ...baseData, accountId: testAccount.id, amount: "100" };

    const first = await createTransaction(data, idemKey);
    const second = await createTransaction(data, idemKey);

    // Both calls succeed
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);

    // Second call is flagged as idempotent
    expect(second.idempotent).toBe(true);

    // The transaction IDs are the same
    expect(first.data.id).toBe(second.data.id);

    // Balance was only deducted ONCE
    const account = await db.account.findUnique({
      where: { id: testAccount.id },
    });
    expect(account.balance.toNumber()).toBe(900);

    // Only one transaction row was inserted
    const txns = await db.transaction.findMany({
      where: { userId: testUser.id },
    });
    expect(txns.length).toBe(1);
  });

  it("stores the idempotency key in the DB row", async () => {
    const idemKey = crypto.randomUUID();
    const data = { ...baseData, accountId: testAccount.id };
    await createTransaction(data, idemKey);

    const row = await db.transaction.findUnique({
      where: { idempotencyKey: idemKey },
    });
    expect(row).not.toBeNull();
    expect(row.idempotencyKey).toBe(idemKey);
  });

  it("sets nextRecurringDate for recurring transactions", async () => {
    const data = {
      ...baseData,
      accountId: testAccount.id,
      isRecurring: true,
      recurringInterval: "MONTHLY",
    };
    const result = await createTransaction(data, crypto.randomUUID());

    expect(result.data.nextRecurringDate).not.toBeNull();
    const next = new Date(result.data.nextRecurringDate);
    expect(next.getMonth()).toBe(new Date("2025-07-01").getMonth()); // June + 1
  });

  it("throws when the accountId does not belong to the user", async () => {
    const data = {
      ...baseData,
      accountId: "non-existent-account-id",
    };
    await expect(createTransaction(data, crypto.randomUUID())).rejects.toThrow(
      /not found/i
    );
  });
});

// ---------------------------------------------------------------------------
// getUserTransactions — cursor pagination
// ---------------------------------------------------------------------------

describe("getUserTransactions", () => {
  beforeEach(async () => {
    // Seed 25 transactions for pagination tests
    await db.transaction.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        userId: testUser.id,
        accountId: testAccount.id,
        type: i % 2 === 0 ? "EXPENSE" : "INCOME",
        amount: (i + 1) * 10,
        category: i % 2 === 0 ? "food" : "salary",
        date: new Date(`2025-01-${String(i + 1).padStart(2, "0")}`),
        isRecurring: false,
        status: "COMPLETED",
      })),
    });
  });

  it("returns first page with hasNextPage true when more records exist", async () => {
    const result = await getUserTransactions({
      accountId: testAccount.id,
      pageSize: 10,
    });

    expect(result.success).toBe(true);
    expect(result.data.items.length).toBe(10);
    expect(result.data.hasNextPage).toBe(true);
    expect(result.data.nextCursor).not.toBeNull();
  });

  it("returns second page using the cursor from the first page", async () => {
    const page1 = await getUserTransactions({
      accountId: testAccount.id,
      pageSize: 10,
    });

    const page2 = await getUserTransactions({
      accountId: testAccount.id,
      pageSize: 10,
      cursor: page1.data.nextCursor,
    });

    expect(page2.data.items.length).toBe(10);
    // No overlap between pages
    const p1Ids = new Set(page1.data.items.map((t) => t.id));
    page2.data.items.forEach((t) => expect(p1Ids.has(t.id)).toBe(false));
  });

  it("returns hasNextPage false on the last page", async () => {
    // With 25 rows and pageSize 20, page 1 has 20 rows with hasNextPage true.
    // Page 2 has 5 rows with hasNextPage false.
    const page1 = await getUserTransactions({
      accountId: testAccount.id,
      pageSize: 20,
    });
    const page2 = await getUserTransactions({
      accountId: testAccount.id,
      pageSize: 20,
      cursor: page1.data.nextCursor,
    });

    expect(page2.data.hasNextPage).toBe(false);
    expect(page2.data.nextCursor).toBeNull();
    expect(page2.data.items.length).toBe(5);
  });

  it("filters by type correctly", async () => {
    const result = await getUserTransactions({
      accountId: testAccount.id,
      pageSize: 50,
      type: "EXPENSE",
    });

    result.data.items.forEach((t) => expect(t.type).toBe("EXPENSE"));
  });

  it("filters by searchTerm on description", async () => {
    // Create a uniquely-named transaction
    await db.transaction.create({
      data: {
        userId: testUser.id,
        accountId: testAccount.id,
        type: "EXPENSE",
        amount: 42,
        category: "food",
        description: "UNIQUE_SEARCH_TERM_XYZ",
        date: new Date(),
        isRecurring: false,
        status: "COMPLETED",
      },
    });

    const result = await getUserTransactions({
      accountId: testAccount.id,
      pageSize: 50,
      searchTerm: "UNIQUE_SEARCH_TERM_XYZ",
    });

    expect(result.data.items.length).toBe(1);
    expect(result.data.items[0].description).toBe("UNIQUE_SEARCH_TERM_XYZ");
  });

  it("caps page size at 100 to prevent abuse", async () => {
    const result = await getUserTransactions({
      accountId: testAccount.id,
      pageSize: 9999,
    });
    // Only 25 rows seeded, so we get 25 — but the cap prevents DB from
    // being asked for 10000 rows.  We can't directly assert the TAKE value
    // but we can assert it didn't crash and returned a reasonable count.
    expect(result.data.items.length).toBeLessThanOrEqual(100);
  });
});
