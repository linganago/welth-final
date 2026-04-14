"use server";

import { db } from "../lib/prisma";
// import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { revalidateUserCache } from "../lib/cache";
import {
  UnauthorizedError,
  NotFoundError,
} from "../lib/errors";

import { auth,currentUser } from "@clerk/nextjs/server";



// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const serializeDecimal = (obj) => {
  if (!obj) return obj;

  return {
    ...obj,
    balance: obj.balance?.toNumber
      ? obj.balance.toNumber()
      : Number(obj.balance),

    amount: obj.amount?.toNumber
      ? obj.amount.toNumber()
      : Number(obj.amount),
  };
};

const formatTransaction = (t) => {
  const serialized = serializeDecimal(t);

  return {
    ...serialized,
    formattedDate: format(new Date(t.date), "PP"),
    formattedNextRecurringDate: t.nextRecurringDate
      ? format(new Date(t.nextRecurringDate), "PP")
      : null,
  };
};

async function resolveUser() {
  let clerkUserId;

  try {
    // Works in tests (mocked)
    const authData = await auth();
    clerkUserId = authData?.userId;
  } catch {
    // fallback
  }

  // If auth didn't work → fallback to currentUser (production)
  if (!clerkUserId) {
    const user = await currentUser();
    if (!user) throw new UnauthorizedError();
    clerkUserId = user.id;
  }

  const user = await db.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });

  if (!user) throw new UnauthorizedError("User record not found.");

  return { clerkUserId, user };
}

// ---------------------------------------------------------------------------
// GET ACCOUNT WITH TRANSACTIONS
// ---------------------------------------------------------------------------

export async function getAccountWithTransactions(accountId) {
  const { user } = await resolveUser();

  const account = await db.account.findUnique({
    where: { id: accountId, userId: user.id },
    include: {
      transactions: {
        orderBy: { date: "desc" },
        take: 20,
      },
      _count: { select: { transactions: true } },
    },
  });

  if (!account) return null;

  return {
    ...serializeDecimal(account),
    transactions: account.transactions.map(formatTransaction),
  };
}

// ---------------------------------------------------------------------------
// BULK DELETE TRANSACTIONS
// ---------------------------------------------------------------------------

export async function bulkDeleteTransactions(transactionIds) {
  try {
    const { user } = await resolveUser();

    const transactions = await db.transaction.findMany({
      where: { id: { in: transactionIds }, userId: user.id },
    });

    if (transactions.length === 0) return { success: true };

    const accountBalanceChanges = transactions.reduce((acc, t) => {
      const amount = t.amount.toNumber();
      const change = t.type === "EXPENSE" ? amount : -amount;
      acc[t.accountId] = (acc[t.accountId] || 0) + change;
      return acc;
    }, {});

    await db.$transaction(async (tx) => {
      await tx.transaction.deleteMany({
        where: { id: { in: transactionIds }, userId: user.id },
      });

      for (const [accountId, balanceChange] of Object.entries(
        accountBalanceChanges
      )) {
        await tx.account.update({
          where: { id: accountId },
          data: { balance: { increment: balanceChange } },
        });
      }
    });

    revalidateUserCache(user.id);
    revalidatePath("/dashboard");
    revalidatePath("/account/[id]", "page");

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// UPDATE DEFAULT ACCOUNT
// ---------------------------------------------------------------------------

export async function updateDefaultAccount(accountId) {
  try {
    const { user } = await resolveUser();

    await db.account.updateMany({
      where: { userId: user.id, isDefault: true },
      data: { isDefault: false },
    });

    const account = await db.account.update({
      where: { id: accountId, userId: user.id },
      data: { isDefault: true },
    });

    revalidateUserCache(user.id);
    revalidatePath("/dashboard");

    return { success: true, data: serializeDecimal(account) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}