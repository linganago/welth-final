"use server";

import { db } from "../lib/prisma";
// import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { withBudgetCache, revalidateUserCache } from "../lib/cache";
import { UnauthorizedError, ValidationError } from "../lib/errors";
import logger from "../lib/logger";

import { auth,currentUser } from "@clerk/nextjs/server";



// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


const serializeBudget = (b) => ({
  ...b,
  amount: b.amount?.toNumber ? b.amount.toNumber() : b.amount,
});

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
// GET CURRENT BUDGET (global — for dashboard progress bar)
// ---------------------------------------------------------------------------

export async function getCurrentBudget(accountId) {
  try {
    const { user } = await resolveUser();

    const budget = await withBudgetCache(user.id, async () => {
      return db.budget.findFirst({
        where: { userId: user.id, category: null },
      });
    });

    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const expenses = await db.transaction.aggregate({
      where: {
        userId: user.id,
        type: "EXPENSE",
        date: { gte: startOfMonth, lte: endOfMonth },
        accountId,
      },
      _sum: { amount: true },
    });

    return {
  budget: budget ? serializeBudget(budget) : null,
  currentExpenses: expenses._sum.amount
    ? expenses._sum.amount.toNumber()
    : 0,
}
  } catch (error) {
    logger.error("Error fetching budget", error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// GET ALL BUDGETS WITH PROGRESS (global + per-category)
// ---------------------------------------------------------------------------

/**
 * Returns every budget the user has set, each with the current month's
 * actual spending and a percentage used figure.
 *
 * Used by the new BudgetManager component on the dashboard.
 */
export async function getAllBudgetsWithProgress() {
  try {
    const { user } = await resolveUser();

    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    // Fetch all user budgets and all current-month expenses in parallel
    const [budgets, expensesByCategory] = await Promise.all([
      db.budget.findMany({ where: { userId: user.id } }),
      db.transaction.groupBy({
        by: ["category"],
        where: {
          userId: user.id,
          type: "EXPENSE",
          date: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      }),
    ]);

    const spendingMap = Object.fromEntries(
      expensesByCategory.map((e) => [e.category, e._sum.amount?.toNumber() ?? 0])
    );

    const totalSpending = Object.values(spendingMap).reduce((a, b) => a + b, 0);

    return budgets.map((b) => {
      const budgetAmount = b.amount.toNumber();
      const spent = b.category === null ? totalSpending : (spendingMap[b.category] ?? 0);
      const percentage = budgetAmount > 0 ? Math.min(100, (spent / budgetAmount) * 100) : 0;

      return {
        id: b.id,
        category: b.category,   // null = global
        amount: budgetAmount,
        spent,
        percentage,
        remaining: Math.max(0, budgetAmount - spent),
        isOverBudget: spent > budgetAmount,
      };
    });
  }  catch (error) {
    logger.error("Error fetching all budgets", error);
    // Return empty array instead of throwing so the dashboard page
    // still renders even if the budget query fails (e.g. DB connection issue).
    return [];
  }
}

// ---------------------------------------------------------------------------
// UPSERT BUDGET (create or update, global or per-category)
// ---------------------------------------------------------------------------

/**
 * Creates or updates a budget.
 *
 * @param {object} params
 * @param {number}  params.amount    Monthly budget amount
 * @param {string|null} params.category  null = global budget, string = category
 */
export async function upsertBudget({ amount, category = null }) {
  try {
    const { user } = await resolveUser();

    if (isNaN(amount) || amount <= 0) {
      throw new ValidationError("Budget amount must be a positive number.");
    }

    let budget;

    // ✅ FIX: handle NULL category separately
    if (category === null) {
      const existing = await db.budget.findFirst({
        where: { userId: user.id, category: null },
      });

      if (existing) {
        budget = await db.budget.update({
          where: { id: existing.id },
          data: { amount },
        });
      } else {
        budget = await db.budget.create({
          data: {
            userId: user.id,
            amount,
            category: null,
          },
        });
      }
    } else {
      // ✅ keep original behavior for categories
      budget = await db.budget.upsert({
        where: {
          userId_category: {
            userId: user.id,
            category,
          },
        },
        update: { amount },
        create: { userId: user.id, amount, category },
      });
    }

    revalidateUserCache(user.id);
    revalidatePath("/dashboard");

    return {
      success: true,
      data: {
        ...budget,
        amount: budget.amount.toNumber(),
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// UPDATE BUDGET (legacy — used by existing BudgetProgress component)
// ---------------------------------------------------------------------------

export async function updateBudget(amount) {
  return upsertBudget({ amount, category: null });
}

// ---------------------------------------------------------------------------
// DELETE BUDGET
// ---------------------------------------------------------------------------

export async function deleteBudget(budgetId) {
  try {
    const { user } = await resolveUser();

    await db.budget.delete({
      where: { id: budgetId, userId: user.id },
    });

    revalidateUserCache(user.id);
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    logger.error("Error deleting budget", error);
    return { success: false, error: error.message };
  }
}
