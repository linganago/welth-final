/**
 * Structured JSON logger.
 *
 * Outputs log lines as JSON objects so they are searchable in Vercel's
 * log drain and any other log aggregator (Datadog, Logtail, etc.).
 *
 * Usage:
 *   import logger from "@/lib/logger";
 *   logger.info("Transaction created", { userId, transactionId, amount });
 *   logger.error("Balance update failed", error, { accountId });
 *
 * In production all levels are written to stdout/stderr.
 * In test the logger is a no-op to keep test output clean.
 */

const isSilent = process.env.NODE_ENV === "test";

function write(level, stream, message, extras = {}) {
  if (isSilent) return;
  const line = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    ...extras,
  });
  stream.write(line + "\n");
}

const logger = {
  info(message, context = {}) {
    write("info", process.stdout, message, context);
  },

  warn(message, context = {}) {
    write("warn", process.stderr, message, context);
  },

  /**
   * @param {string} message
   * @param {Error|unknown} error
   * @param {object} context
   */
  error(message, error, context = {}) {
    write("error", process.stderr, message, {
      error: error instanceof Error ? error.message : String(error),
      // Only include stack in development — never leak internals in production logs
      ...(process.env.NODE_ENV !== "production" && error instanceof Error
        ? { stack: error.stack }
        : {}),
      ...context,
    });
  },

  debug(message, context = {}) {
    if (process.env.NODE_ENV === "production") return;
    write("debug", process.stdout, message, context);
  },
};

export default logger;
