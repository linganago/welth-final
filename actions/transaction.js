"use server";

// import { auth } from "@clerk/nextjs/server";
import { db } from "../lib/prisma";
import { revalidatePath } from "next/cache";
import { revalidateTransactionCache } from "../lib/cache";
import { GoogleGenerativeAI } from "@google/generative-ai";
import aj from "../lib/arcjet";
import { request } from "@arcjet/next";
import {
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  RateLimitError,
} from "../lib/errors";
import { transactionSchema } from "../app/lib/schema";
import { calculateNextRecurringDate } from "../lib/recurring-utils";
import { uploadReceipt } from "../lib/supabase-storage";
import logger from "../lib/logger";
import { inngest } from "../lib/inngest/client";
import { auth,currentUser } from "@clerk/nextjs/server";


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const serializeTransaction = (obj) => ({
  ...obj,
  amount: obj.amount?.toNumber
    ? obj.amount.toNumber()
    : Number(obj.amount || 0),
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
// CREATE TRANSACTION
// ---------------------------------------------------------------------------

export async function createTransaction(data, idempotencyKey) {
  const { clerkUserId, user } = await resolveUser();

  // Rate limiting
  const req = await request();
  const decision = await aj.protect(req, { userId: clerkUserId, requested: 1 });
  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      throw new RateLimitError(decision.reason.reset);
    }
    throw new ValidationError("Request blocked by security policy.");
  }

  // Idempotency — return existing transaction without side effects
  if (idempotencyKey) {
  const existing = await db.transaction.findUnique({
    where: { idempotencyKey },
  });

  if (existing) {
    return {
      success: true,
      data: serializeTransaction(existing),
      idempotent: true,
    };
  }
}

  // Server-side validation
  const parseResult = transactionSchema.safeParse(data);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.issues[0].message);
  }
  const validatedData = parseResult.data;

  // Verify account ownership
  const account = await db.account.findUnique({
    where: { id: validatedData.accountId, userId: user.id },
  });
  if (!account) throw new NotFoundError("Account");

  const amount = validatedData.amount;
  const balanceChange = validatedData.type === "EXPENSE" ? -amount : amount;
  const newBalance = account.balance.toNumber() + balanceChange;

  // Atomic write
  const transaction = await db.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        type: validatedData.type,
        amount,
        description: validatedData.description ?? null,
        date: validatedData.date,
        category: validatedData.category,
        receiptUrl: validatedData.receiptUrl ?? null,
        isRecurring: validatedData.isRecurring,
        recurringInterval: validatedData.recurringInterval ?? null,
        nextRecurringDate:
          validatedData.isRecurring && validatedData.recurringInterval
            ? calculateNextRecurringDate(
                validatedData.date,
                validatedData.recurringInterval
              )
            : null,
        userId: user.id,
        accountId: validatedData.accountId,
        ...(idempotencyKey ? { idempotencyKey } : {}),
      },
    });

    await tx.account.update({
      where: { id: validatedData.accountId },
      data: { balance: newBalance },
    });

    return created;
  });

  logger.info("Transaction created", {
    userId: user.id,
    transactionId: transaction.id,
    amount,
    type: validatedData.type,
    category: validatedData.category,
  });

  // Fire anomaly detection event (non-blocking — does not affect response time)
  // Inngest processes this asynchronously in the background
  try {
    await inngest.send({
      name: "transaction.created",
      data: {
        userId: user.id,
        transactionId: transaction.id,
        category: validatedData.category,
        amount,
        type: validatedData.type,
      },
    });
  } catch (err) {
    // Non-fatal — anomaly detection failure should never block transaction creation
    logger.warn("Failed to send transaction.created event to Inngest", {
      transactionId: transaction.id,
      error: err?.message,
    });
  }

  revalidateTransactionCache(user.id);
  revalidatePath("/dashboard");
  revalidatePath(`/account/${transaction.accountId}`);

  return { success: true, data: serializeTransaction(transaction) };
}

// ---------------------------------------------------------------------------
// GET SINGLE TRANSACTION
// ---------------------------------------------------------------------------

export async function getTransaction(id) {
  const { user } = await resolveUser();

  const transaction = await db.transaction.findUnique({
    where: { id, userId: user.id },
  });
  if (!transaction) throw new NotFoundError("Transaction");

  return serializeTransaction(transaction);
}

// ---------------------------------------------------------------------------
// UPDATE TRANSACTION
// ---------------------------------------------------------------------------

export async function updateTransaction(id, data) {
  const { user } = await resolveUser();

  const parseResult = transactionSchema.safeParse(data);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.issues[0].message);
  }
  const validatedData = parseResult.data;

  const original = await db.transaction.findUnique({
    where: { id, userId: user.id },
    include: { account: true },
  });
  if (!original) throw new NotFoundError("Transaction");

  const amount = parseFloat(validatedData.amount);
  const oldDelta =
    original.type === "EXPENSE"
      ? -original.amount.toNumber()
      : original.amount.toNumber();
  const newDelta = validatedData.type === "EXPENSE" ? -amount : amount;
  const netChange = newDelta - oldDelta;

  const transaction = await db.$transaction(async (tx) => {
    const updated = await tx.transaction.update({
      where: { id, userId: user.id },
      data: {
        type: validatedData.type,
        amount,
        description: validatedData.description ?? null,
        date: validatedData.date,
        category: validatedData.category,
        isRecurring: validatedData.isRecurring,
        recurringInterval: validatedData.recurringInterval ?? null,
        nextRecurringDate:
          validatedData.isRecurring && validatedData.recurringInterval
            ? calculateNextRecurringDate(
                validatedData.date,
                validatedData.recurringInterval
              )
            : null,
        accountId: validatedData.accountId,
      },
    });

    await tx.account.update({
      where: { id: validatedData.accountId },
      data: { balance: { increment: netChange } },
    });

    return updated;
  });

  revalidateTransactionCache(user.id);
  revalidatePath("/dashboard");
  revalidatePath(`/account/${transaction.accountId}`);

  return { success: true, data: serializeTransaction(transaction) };
}

// ---------------------------------------------------------------------------
// GET USER TRANSACTIONS — cursor pagination
// ---------------------------------------------------------------------------

export async function getUserTransactions({
  accountId,
  cursor,
  pageSize = 20,
  type,
  startDate,
  endDate,
  searchTerm,
  recurringFilter,
} = {}) {
  const { user } = await resolveUser();

  const take = Math.min(Math.max(1, pageSize), 100);

  const where = {
    userId: user.id,
    ...(accountId && { accountId }),
    ...(type && { type }),
    ...((startDate || endDate) && {
      date: {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      },
    }),
    ...(searchTerm && {
      description: { contains: searchTerm, mode: "insensitive" },
    }),
    ...(recurringFilter === "recurring" && { isRecurring: true }),
    ...(recurringFilter === "non-recurring" && { isRecurring: false }),
  };

  const transactions = await db.transaction.findMany({
    where,
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { date: "desc" },
    include: { account: { select: { name: true, type: true } } },
  });

  const hasNextPage = transactions.length > take;
  const items = hasNextPage ? transactions.slice(0, take) : transactions;
  const nextCursor = hasNextPage ? items[items.length - 1].id : null;

  return {
  success: true,
  data: {
    items: items.map(serializeTransaction),
    nextCursor,
    hasNextPage,
  },
};
}

// ---------------------------------------------------------------------------
// EXPORT CSV
// ---------------------------------------------------------------------------

export async function exportTransactionsCSV({ accountId, startDate, endDate } = {}) {
  const { user } = await resolveUser();

  const transactions = await db.transaction.findMany({
    where: {
      userId: user.id,
      ...(accountId && { accountId }),
      ...((startDate || endDate) && {
        date: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      }),
    },
    include: { account: { select: { name: true } } },
    orderBy: { date: "desc" },
  });

  const headers = ["Date", "Description", "Category", "Type", "Amount", "Account", "Status", "Receipt URL"];

  const rows = transactions.map((t) => [
    new Date(t.date).toISOString().split("T")[0],
    t.description ?? "",
    t.category,
    t.type,
    t.amount.toNumber().toFixed(2),
    t.account.name,
    t.status,
    t.receiptUrl ?? "",
  ]);

  const escape = (val) => {
    const str = String(val);
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");

  logger.info("CSV export", { userId: user.id, rowCount: rows.length });

  return { success: true, data: csv, count: rows.length };
}

// ---------------------------------------------------------------------------
// SCAN RECEIPT
// ---------------------------------------------------------------------------

export async function scanReceipt(file) {
  const { user } = await resolveUser();

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const [uploadResult, aiResult] = await Promise.allSettled([
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      ? uploadReceipt(file, user.id)
      : Promise.resolve(null),

    (async () => {
      const arrayBuffer = await file.arrayBuffer();
      const base64String = Buffer.from(arrayBuffer).toString("base64");

      const prompt = `
        Analyze this receipt image and extract the following information in JSON format:
        - Total amount (just the number)
        - Date (in ISO format)
        - Description or items purchased (brief summary)
        - Merchant/store name
        - Suggested category (one of: housing,transportation,groceries,utilities,
          entertainment,food,shopping,healthcare,education,personal,travel,
          insurance,gifts,bills,other-expense)

        Only respond with valid JSON, no markdown, no backticks:
        {
          "amount": number,
          "date": "ISO date string",
          "description": "string",
          "merchantName": "string",
          "category": "string"
        }

        If the image is not a receipt, return an empty JSON object: {}
      `;

      const result = await model.generateContent([
        { inlineData: { data: base64String, mimeType: file.type } },
        prompt,
      ]);
      return result.response.text().replace(/```(?:json)?\n?/g, "").trim();
    })(),
  ]);

  if (aiResult.status === "rejected") {
    throw new ValidationError("AI scan failed. Please try again.");
  }

  let parsed;
  try {
    parsed = JSON.parse(aiResult.value);
  } catch {
    throw new ValidationError("Could not parse AI response. Please try again.");
  }

  if (!parsed || Object.keys(parsed).length === 0) {
    throw new ValidationError("The uploaded image does not appear to be a receipt.");
  }

  const receiptUrl = uploadResult.status === "fulfilled" ? uploadResult.value : null;

  if (uploadResult.status === "rejected") {
    logger.warn("Receipt upload failed (scan still succeeded)", { userId: user.id });
  }

  return {
    amount: parseFloat(parsed.amount),
    date: new Date(parsed.date),
    description: parsed.description ?? "",
    category: parsed.category ?? "other-expense",
    merchantName: parsed.merchantName ?? "",
    receiptUrl,
  };
}
