"use server";

import aj from "../lib/arcjet";
import { db } from "../lib/prisma";
import { request } from "@arcjet/next";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  withAccountsCache,
  withDashboardCache,
  revalidateAccountCache,
  revalidateUserCache,
} from "../lib/cache";
import {
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  RateLimitError,
} from "../lib/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const serializeTransaction = (obj) => {
  const serialized = { ...obj };
  if (obj.balance?.toNumber) serialized.balance = obj.balance.toNumber();
  if (obj.amount?.toNumber) serialized.amount = obj.amount.toNumber();
  return serialized;
};

async function resolveUser() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) throw new UnauthorizedError();

  const user = await db.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) throw new UnauthorizedError("User record not found.");

  return { clerkUserId, user };
}

// ---------------------------------------------------------------------------
// GET USER ACCOUNTS  (cached)
// ---------------------------------------------------------------------------

export async function getUserAccounts() {
  const { user } = await resolveUser();

  // withAccountsCache returns the result of the inner fetcher,
  // served from the Next.js Data Cache when available.
  const accounts = await withAccountsCache(user.id, async () => {
    return db.account.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { transactions: true } },
      },
    });
  });

  return accounts.map(serializeTransaction);
}

// ---------------------------------------------------------------------------
// CREATE ACCOUNT
// ---------------------------------------------------------------------------

export async function createAccount(data) {
  const { clerkUserId, user } = await resolveUser();

  // Rate limiting
  const req = await request();
  const decision = await aj.protect(req, { userId: clerkUserId, requested: 1 });

  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      const { reset } = decision.reason;
      throw new RateLimitError(reset);
    }
    throw new ValidationError("Request blocked by security policy.");
  }

  const balanceFloat = parseFloat(data.balance);
  if (isNaN(balanceFloat)) throw new ValidationError("Invalid balance amount.");

  const existingAccounts = await db.account.findMany({
    where: { userId: user.id },
    select: { id: true },
  });

  const shouldBeDefault = existingAccounts.length === 0 ? true : data.isDefault;

  if (shouldBeDefault) {
    await db.account.updateMany({
      where: { userId: user.id, isDefault: true },
      data: { isDefault: false },
    });
  }

  const account = await db.account.create({
    data: {
      ...data,
      balance: balanceFloat,
      userId: user.id,
      isDefault: shouldBeDefault,
    },
  });

  // Invalidate account caches so the next read fetches fresh data
  revalidateAccountCache(user.id);
  revalidatePath("/dashboard");

  return { success: true, data: serializeTransaction(account) };
}

// ---------------------------------------------------------------------------
// GET DASHBOARD DATA  (cached, last 30 transactions only)
// ---------------------------------------------------------------------------

export async function getDashboardData() {
  const { user } = await resolveUser();

  // Dashboard only needs the most recent 30 transactions for the overview chart.
  // The full paginated list lives in the account detail page.
  const transactions = await withDashboardCache(user.id, async () => {
    return db.transaction.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
      take: 30,
    });
  });

  return transactions.map(serializeTransaction);
}
