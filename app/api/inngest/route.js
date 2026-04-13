import { serve } from "inngest/next";
import { inngest } from "../../../lib/inngest/client";
import {
  checkBudgetAlerts,
  detectSpendingAnomaly,
  generateMonthlyReports,
  processRecurringTransaction,
  triggerRecurringTransactions,
} from "../../../lib/inngest/function";

/**
 * Inngest webhook endpoint.
 *
 * Security:
 * The `serve()` handler from inngest/next automatically verifies the
 * X-Inngest-Signature header on every incoming POST request using the
 * INNGEST_SIGNING_KEY environment variable.
 *
 * If INNGEST_SIGNING_KEY is set, any request without a valid signature
 * is rejected with 401 before any function code runs.
 *
 * For local development with `npx inngest-cli@latest dev`, the dev server
 * sends valid signatures automatically so no manual setup is needed.
 *
 * Ref: https://www.inngest.com/docs/sdk/serve#signing-key
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processRecurringTransaction,
    triggerRecurringTransactions,
    generateMonthlyReports,
    checkBudgetAlerts,
    detectSpendingAnomaly,    // NEW: anomaly detection
  ],
  // Enforce signing key verification in production.
  // In development (NODE_ENV=development), Inngest relaxes verification
  // automatically when running against the local dev server.
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
