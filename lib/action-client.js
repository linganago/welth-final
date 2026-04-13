/**
 * createAction — wraps a server action handler with:
 *   1. Structured error catching (AppError hierarchy → typed response)
 *   2. Consistent return shape: { success, data?, error? }
 *
 * Usage:
 *   export const createTransaction = createAction(async (data, idempotencyKey) => {
 *     // ... business logic
 *     return transactionRecord;
 *   });
 *
 * The caller always receives either:
 *   { success: true,  data: <return value of handler> }
 *   { success: false, error: { message, code } }
 *
 * This means client components never have to wrap calls in try/catch;
 * they just check `result.success`.
 */

import { normaliseError } from "./errors";

/**
 * @template TArgs - tuple of argument types the action handler accepts
 * @template TReturn - return type of the action handler
 * @param {(...args: TArgs) => Promise<TReturn>} handler
 * @returns {(...args: TArgs) => Promise<{ success: boolean; data?: TReturn; error?: { message: string; code: string } }>}
 */
export function createAction(handler) {
  return async (...args) => {
    try {
      const data = await handler(...args);
      return { success: true, data };
    } catch (err) {
      const appErr = normaliseError(err);

      // Log unexpected server errors (non-client faults)
      if (appErr.statusCode >= 500) {
        console.error("[Action Error]", {
          name: appErr.name,
          code: appErr.code,
          message: appErr.message,
          // stack only in dev so we don't leak internals in prod logs
          ...(process.env.NODE_ENV !== "production" && { stack: appErr.stack }),
        });
      }

      return {
        success: false,
        error: {
          message: appErr.message,
          code: appErr.code,
        },
      };
    }
  };
}
