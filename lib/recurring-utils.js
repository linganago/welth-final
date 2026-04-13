/**
 * Pure date-calculation utilities for recurring transactions.
 * No "use server" — safe to import from both server and client contexts.
 */
import { ValidationError } from "./errors";

/**
 * Calculates the next due date for a recurring transaction.
 * Does NOT mutate the input date.
 *
 * @param {Date}   startDate
 * @param {"DAILY"|"WEEKLY"|"MONTHLY"|"YEARLY"} interval
 * @returns {Date}
 */
export function calculateNextRecurringDate(startDate, interval) {
  const date = new Date(startDate);
  switch (interval) {
    case "DAILY":
      date.setDate(date.getDate() + 1);
      break;
    case "WEEKLY":
      date.setDate(date.getDate() + 7);
      break;
    case "MONTHLY":
      date.setMonth(date.getMonth() + 1);
      break;
    case "YEARLY":
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      throw new ValidationError(`Unknown recurring interval: ${interval}`);
  }
  return date;
}
