import { inngest } from "./client";
import { db } from "../prisma";
import EmailTemplate from "../../emails/template";
import { sendEmail } from "../../actions/send-email";
import { GoogleGenerativeAI } from "@google/generative-ai";
import logger from "../logger";

// ---------------------------------------------------------------------------
// 1. Recurring Transaction Processing
// ---------------------------------------------------------------------------

export const processRecurringTransaction = inngest.createFunction(
  {
    id: "process-recurring-transaction",
    name: "Process Recurring Transaction",
    throttle: {
      limit: 10,
      period: "1m",
      key: "event.data.userId",
    },
  },
  { event: "transaction.recurring.process" },
  async ({ event, step }) => {
    if (!event?.data?.transactionId || !event?.data?.userId) {
      logger.error("Invalid recurring transaction event data", new Error("Missing fields"), { event });
      return { error: "Missing required event data" };
    }

    await step.run("process-transaction", async () => {
      const transaction = await db.transaction.findUnique({
        where: {
          id: event.data.transactionId,
          userId: event.data.userId,
        },
        include: { account: true },
      });

      if (!transaction || !isTransactionDue(transaction)) return;

      await db.$transaction(async (tx) => {
        await tx.transaction.create({
          data: {
            type: transaction.type,
            amount: transaction.amount,
            description: `${transaction.description} (Recurring)`,
            date: new Date(),
            category: transaction.category,
            userId: transaction.userId,
            accountId: transaction.accountId,
            isRecurring: false,
          },
        });

        const balanceChange =
          transaction.type === "EXPENSE"
            ? -transaction.amount.toNumber()
            : transaction.amount.toNumber();

        await tx.account.update({
          where: { id: transaction.accountId },
          data: { balance: { increment: balanceChange } },
        });

        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            lastProcessed: new Date(),
            nextRecurringDate: calculateNextRecurringDate(
              new Date(),
              transaction.recurringInterval
            ),
          },
        });
      });
    });
  }
);

// ---------------------------------------------------------------------------
// 2. Trigger Recurring Transactions (daily cron)
// ---------------------------------------------------------------------------

export const triggerRecurringTransactions = inngest.createFunction(
  {
    id: "trigger-recurring-transactions",
    name: "Trigger Recurring Transactions",
  },
  { cron: "0 0 * * *" },
  async ({ step }) => {
    const recurringTransactions = await step.run(
      "fetch-recurring-transactions",
      async () => {
        return db.transaction.findMany({
          where: {
            isRecurring: true,
            status: "COMPLETED",
            OR: [
              { lastProcessed: null },
              { nextRecurringDate: { lte: new Date() } },
            ],
          },
        });
      }
    );

    if (recurringTransactions.length > 0) {
      const events = recurringTransactions.map((t) => ({
        name: "transaction.recurring.process",
        data: { transactionId: t.id, userId: t.userId },
      }));
      await inngest.send(events);
    }

    return { triggered: recurringTransactions.length };
  }
);

// ---------------------------------------------------------------------------
// 3. Monthly Report Generation
// ---------------------------------------------------------------------------

async function generateFinancialInsights(stats, month) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    Analyze this financial data and provide 3 concise, actionable insights.
    Focus on spending patterns and practical advice.
    Keep it friendly and conversational.

    Financial Data for ${month}:
    - Total Income: $${stats.totalIncome}
    - Total Expenses: $${stats.totalExpenses}
    - Net Income: $${stats.totalIncome - stats.totalExpenses}
    - Expense Categories: ${Object.entries(stats.byCategory)
      .map(([cat, amt]) => `${cat}: $${amt}`)
      .join(", ")}

    Format the response as a JSON array of strings:
    ["insight 1", "insight 2", "insight 3"]
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```(?:json)?\n?/g, "").trim();
    return JSON.parse(text);
  } catch (error) {
    logger.error("Failed to generate financial insights", error);
    return [
      "Your highest expense category this month might need attention.",
      "Consider setting up a budget for better financial management.",
      "Track your recurring expenses to identify potential savings.",
    ];
  }
}

export const generateMonthlyReports = inngest.createFunction(
  {
    id: "generate-monthly-reports",
    name: "Generate Monthly Reports",
  },
  { cron: "0 0 1 * *" },
  async ({ step }) => {
    const users = await step.run("fetch-users", async () => {
      return db.user.findMany({ include: { accounts: true } });
    });

    for (const user of users) {
      await step.run(`generate-report-${user.id}`, async () => {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        const stats = await getMonthlyStats(user.id, lastMonth);
        const monthName = lastMonth.toLocaleString("default", { month: "long" });
        const insights = await generateFinancialInsights(stats, monthName);

        await sendEmail({
          to: user.email,
          subject: `Your Monthly Financial Report - ${monthName}`,
          react: EmailTemplate({
            userName: user.name,
            type: "monthly-report",
            data: { stats, month: monthName, insights },
          }),
        });
      });
    }

    return { processed: users.length };
  }
);

// ---------------------------------------------------------------------------
// 4. Budget Alerts (every 6 hours)
// ---------------------------------------------------------------------------

export const checkBudgetAlerts = inngest.createFunction(
  { id: "check-budget-alerts", name: "Check Budget Alerts" },
  { cron: "0 */6 * * *" },
  async ({ step }) => {
    const budgets = await step.run("fetch-budgets", async () => {
      return db.budget.findMany({
        include: {
          user: {
            include: {
              accounts: { where: { isDefault: true } },
            },
          },
        },
      });
    });

    for (const budget of budgets) {
      const defaultAccount = budget.user.accounts[0];
      if (!defaultAccount) continue;

      await step.run(`check-budget-${budget.id}`, async () => {
        const startDate = new Date();
        startDate.setDate(1);

        const expenses = await db.transaction.aggregate({
          where: {
            userId: budget.userId,
            accountId: defaultAccount.id,
            type: "EXPENSE",
            date: { gte: startDate },
          },
          _sum: { amount: true },
        });

        const totalExpenses =
  typeof expenses._sum.amount === "number"
    ? expenses._sum.amount
    : expenses._sum.amount?.toNumber?.() || 0;
        const budgetAmount =
  typeof budget.amount === "number"
    ? budget.amount
    : budget.amount?.toNumber?.() || 0;
        const percentageUsed = (totalExpenses / budgetAmount) * 100;

        if (
          percentageUsed >= 80 &&
          (!budget.lastAlertSent ||
            isNewMonth(new Date(budget.lastAlertSent), new Date()))
        ) {
          await sendEmail({
            to: budget.user.email,
            subject: `Budget Alert for ${defaultAccount.name}`,
            react: EmailTemplate({
              userName: budget.user.name,
              type: "budget-alert",
              data: {
                percentageUsed,
                budgetAmount: budgetAmount.toFixed(1),
                totalExpenses: totalExpenses.toFixed(1),
                accountName: defaultAccount.name,
              },
            }),
          });

          await db.budget.update({
            where: { id: budget.id },
            data: { lastAlertSent: new Date() },
          });
        }
      });
    }
  }
);

// ---------------------------------------------------------------------------
// 5. Spending Anomaly Detection (NEW)
// ---------------------------------------------------------------------------
// Triggered every time a new transaction is created via the
// "transaction.created" event sent from createTransaction().
//
// Algorithm:
//   1. Fetch the last 3 months of EXPENSE transactions for the same category
//   2. Require at least 5 historical data points (avoid false positives)
//   3. Calculate mean and standard deviation
//   4. Flag the transaction as anomalous if it is more than 2 standard
//      deviations above the mean (z-score > 2) AND more than 2x the mean
//   5. Send a contextual email alert with the Gemini-generated explanation
//
// Why z-score over simple "2x average":
//   A user who always spends $100 on groceries — flagging $210 (2.1x) is
//   appropriate. But a user whose grocery spending varies from $50–$300 should
//   NOT be flagged for a $210 purchase. Z-score accounts for variance.

export const detectSpendingAnomaly = inngest.createFunction(
  {
    id: "detect-spending-anomaly",
    name: "Detect Spending Anomaly",
    // Debounce: wait 2 seconds after event fires before running.
    // Prevents duplicate triggers if client retries.
    debounce: { period: "2s" },
  },
  { event: "transaction.created" },
  async ({ event, step }) => {
    const { userId, transactionId, category, amount, type } = event.data;

    // Only check EXPENSE transactions
    if (type !== "EXPENSE") return { skipped: "not an expense" };

    const result = await step.run("check-anomaly", async () => {
      // Fetch 3 months of historical expenses for this category
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const historical = await db.transaction.findMany({
        where: {
          userId,
          category,
          type: "EXPENSE",
          date: { gte: threeMonthsAgo },
          // Exclude the current transaction from the historical baseline
          NOT: { id: transactionId },
        },
        select: { amount: true },
        orderBy: { date: "desc" },
      });

      // Need at least 5 data points for a reliable baseline
      if (historical.length < 5) {
        return { skipped: "insufficient history", count: historical.length };
      }

      const amounts = historical.map((t) => t.amount.toNumber());
      const n = amounts.length;
      const mean = amounts.reduce((a, b) => a + b, 0) / n;
      const variance = amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
      const stdDev = Math.sqrt(variance);
      const zScore = stdDev > 0 ? (amount - mean) / stdDev : 0;

      logger.info("Anomaly check", {
        userId,
        category,
        amount,
        mean: mean.toFixed(2),
        stdDev: stdDev.toFixed(2),
        zScore: zScore.toFixed(2),
        historicalCount: n,
      });

      // Flag if z-score > 2 (statistically unusual) AND amount > 1.5x mean
      // The second condition prevents flagging when stdDev is very small
      const isAnomalous = zScore > 2 && amount > mean * 1.5;

      if (!isAnomalous) {
        return { anomaly: false, zScore };
      }

      return {
        anomaly: true,
        mean,
        stdDev,
        zScore,
        historicalCount: n,
      };
    });

    if (!result.anomaly) return result;

    // Generate a human-readable explanation using Gemini
    const explanation = await step.run("generate-explanation", async () => {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
          A user just made a spending transaction that is statistically unusual.
          
          Transaction details:
          - Category: ${category}
          - Amount: $${amount}
          - Your 3-month average for this category: $${result.mean.toFixed(2)}
          - Standard deviation: $${result.stdDev.toFixed(2)}
          - Z-score: ${result.zScore.toFixed(1)} (anything above 2 is unusual)

          Write a single friendly, helpful sentence (max 30 words) explaining
          why this might be worth reviewing. Do not use the word "z-score".
          Do not use markdown. Just plain text.
        `;

        const aiResult = await model.generateContent(prompt);
        return aiResult.response.text().trim();
      } catch {
        return `This ${category} transaction of $${amount.toFixed(2)} is significantly higher than your 3-month average of $${result.mean.toFixed(2)}.`;
      }
    });

    // Send the alert email
    await step.run("send-anomaly-alert", async () => {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (!user) return;

      await sendEmail({
        to: user.email,
        subject: `Unusual spending detected — ${category}`,
        react: EmailTemplate({
          userName: user.name,
          type: "anomaly-alert",
          data: {
            category,
            amount,
            mean: result.mean,
            explanation,
          },
        }),
      });

      logger.info("Anomaly alert sent", { userId, category, amount });
    });

    return { anomaly: true, alerted: true, zScore: result.zScore };
  }
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isTransactionDue(transaction) {
  if (!transaction.lastProcessed) return true;
  return new Date(transaction.nextRecurringDate) <= new Date();
}

function isNewMonth(lastAlertDate, currentDate) {
  return (
    lastAlertDate.getMonth() !== currentDate.getMonth() ||
    lastAlertDate.getFullYear() !== currentDate.getFullYear()
  );
}

function calculateNextRecurringDate(date, interval) {
  const next = new Date(date);
  switch (interval) {
    case "DAILY":   next.setDate(next.getDate() + 1); break;
    case "WEEKLY":  next.setDate(next.getDate() + 7); break;
    case "MONTHLY": next.setMonth(next.getMonth() + 1); break;
    case "YEARLY":  next.setFullYear(next.getFullYear() + 1); break;
  }
  return next;
}

async function getMonthlyStats(userId, month) {
  const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
  const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const transactions = await db.transaction.findMany({
    where: { userId, date: { gte: startDate, lte: endDate } },
  });

  return transactions.reduce(
    (stats, t) => {
      const amount = t.amount.toNumber();
      if (t.type === "EXPENSE") {
        stats.totalExpenses += amount;
        stats.byCategory[t.category] = (stats.byCategory[t.category] || 0) + amount;
      } else {
        stats.totalIncome += amount;
      }
      return stats;
    },
    { totalExpenses: 0, totalIncome: 0, byCategory: {}, transactionCount: transactions.length }
  );
}
