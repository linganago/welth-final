/**
 * Thin caching helpers built on top of Next.js unstable_cache.
 *
 * Strategy
 * --------
 * unstable_cache wraps any async function and stores its serialised return
 * value in the Next.js Data Cache (backed by the filesystem in dev and
 * configurable storage in production).  We attach user-scoped tags so we
 * can surgically invalidate only the data that changed.
 *
 * Tag taxonomy
 * ------------
 *   user-<userId>            – all data belonging to a user
 *   accounts-<userId>        – account list for a user
 *   transactions-<userId>    – transaction list / paginated queries
 *   dashboard-<userId>       – aggregated dashboard data
 *   budget-<userId>          – budget records
 *
 * Revalidation
 * ------------
 * Call `revalidateUserCache(userId)` after any write mutation to instantly
 * purge all cached data for that user.  This is called at the end of every
 * createTransaction / updateTransaction / deleteTransaction / updateBudget
 * action so the next request always sees fresh data.
 *
 * TTL
 * ---
 * We set a generous revalidate of 300 s (5 min) as a safety net even if the
 * explicit tag-invalidation somehow misses (e.g. a background Inngest job
 * that creates recurring transactions).
 */

import { unstable_cache, revalidateTag } from "next/cache";

// ---------------------------------------------------------------------------
// Tag builders
// ---------------------------------------------------------------------------

export const tags = {
  user: (userId) => `user-${userId}`,
  accounts: (userId) => `accounts-${userId}`,
  transactions: (userId) => `transactions-${userId}`,
  dashboard: (userId) => `dashboard-${userId}`,
  budget: (userId) => `budget-${userId}`,
};

// ---------------------------------------------------------------------------
// Revalidation helpers — call these in server actions after writes
// ---------------------------------------------------------------------------

/**
 * Invalidates ALL cache entries for a user in one call.
 * Use after any mutation (create / update / delete transaction, update budget, etc.)
 */
export function revalidateUserCache(userId) {
  revalidateTag(tags.user(userId));
  revalidateTag(tags.accounts(userId));
  revalidateTag(tags.transactions(userId));
  revalidateTag(tags.dashboard(userId));
  revalidateTag(tags.budget(userId));
}

/**
 * Invalidates only transaction-related caches (faster if accounts didn't change).
 */
export function revalidateTransactionCache(userId) {
  revalidateTag(tags.transactions(userId));
  revalidateTag(tags.dashboard(userId));
}

/**
 * Invalidates only account-related caches.
 */
export function revalidateAccountCache(userId) {
  revalidateTag(tags.accounts(userId));
  revalidateTag(tags.dashboard(userId));
}

// ---------------------------------------------------------------------------
// Cache wrappers for expensive read queries
// ---------------------------------------------------------------------------

const CACHE_TTL = 300; // 5 minutes in seconds

/**
 * Wraps a "get accounts" fetcher with per-user cache + tags.
 *
 * @param {string} userId  Internal DB user id (not clerkUserId)
 * @param {() => Promise<any>} fetcher  The Prisma query to run on a miss
 */
export function withAccountsCache(userId, fetcher) {
  return unstable_cache(fetcher, [`accounts-${userId}`], {
    tags: [tags.user(userId), tags.accounts(userId)],
    revalidate: CACHE_TTL,
  })();
}

/**
 * Wraps a "get dashboard data" fetcher with per-user cache + tags.
 */
export function withDashboardCache(userId, fetcher) {
  return unstable_cache(fetcher, [`dashboard-${userId}`], {
    tags: [tags.user(userId), tags.dashboard(userId)],
    revalidate: CACHE_TTL,
  })();
}

/**
 * Wraps a "get budget" fetcher with per-user cache + tags.
 */
export function withBudgetCache(userId, fetcher) {
  return unstable_cache(fetcher, [`budget-${userId}`], {
    tags: [tags.user(userId), tags.budget(userId)],
    revalidate: CACHE_TTL,
  })();
}

/**
 * Generic cached query with an explicit cache key.
 * Use for account-specific queries (e.g. paginated transactions for account X).
 *
 * @param {string[]} cacheKey  Array of strings that uniquely identify this query
 * @param {string[]} cacheTags  Tags for invalidation
 * @param {() => Promise<any>} fetcher
 */
export function withCache(cacheKey, cacheTags, fetcher) {
  return unstable_cache(fetcher, cacheKey, {
    tags: cacheTags,
    revalidate: CACHE_TTL,
  })();
}
