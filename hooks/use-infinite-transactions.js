"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getUserTransactions } from "../actions/transaction";
import { toast } from "sonner";

/**
 * useInfiniteTransactions
 * -----------------------
 * Fetches pages of transactions using cursor-based pagination and wires up
 * an IntersectionObserver on the returned `sentinelRef` so that scrolling
 * to the bottom of the list automatically loads the next page.
 *
 * Usage:
 *   const { transactions, isLoading, hasNextPage, sentinelRef } =
 *     useInfiniteTransactions({ accountId: "abc", pageSize: 20 });
 *
 *   // In JSX, place the sentinel at the bottom of the list:
 *   <div ref={sentinelRef} />
 *
 * @param {object}  filters
 * @param {string=} filters.accountId
 * @param {number=} filters.pageSize
 * @param {string=} filters.type
 * @param {string=} filters.startDate
 * @param {string=} filters.endDate
 * @param {string=} filters.searchTerm
 * @param {string=} filters.recurringFilter
 */
export function useInfiniteTransactions(filters = {}) {
  const [pages, setPages] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const sentinelRef = useRef(null);

  // Stable serialisation of filters for change detection
  const filtersKey = JSON.stringify(filters);

  const loadPage = useCallback(
    async (cursor) => {
      if (isLoading) return;
      setIsLoading(true);
      try {
        const result = await getUserTransactions({
          ...filters,
          cursor: cursor ?? undefined,
          pageSize: filters.pageSize ?? 20,
        });

        if (!result.success) {
          toast.error(result.error?.message ?? "Failed to load transactions.");
          return;
        }

        const { items, nextCursor: nc, hasNextPage: hnp } = result.data;

       setPages((prev) => {
  const newPages = cursor ? [...prev, items] : [items];

  // 🔥 FLATTEN + REMOVE DUPLICATES BY ID
  const uniqueMap = new Map();

  newPages.flat().forEach((t) => {
    uniqueMap.set(t.id, t);
  });

  return [Array.from(uniqueMap.values())];
});
        setNextCursor(nc);
        setHasNextPage(hnp);
      } catch (err) {
        toast.error(err?.message ?? "Failed to load transactions.");
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtersKey, isLoading]
  );

  // Reset and reload whenever filters change
  useEffect(() => {
    setPages([]);
    setNextCursor(null);
    setHasNextPage(true);
    loadPage(null);
    // loadPage is intentionally omitted — we only want to trigger on filter changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  // IntersectionObserver: trigger next page when sentinel enters the viewport
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isLoading) {
          loadPage(nextCursor);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextCursor, hasNextPage, isLoading, loadPage]);

  return {
    /** All loaded transactions across every page, flat. */
    transactions: pages.flat(),
    isLoading,
    hasNextPage,
    /** Attach to a <div> at the bottom of your list to trigger auto-load. */
    sentinelRef,
    /** Call this to reset and reload from the first page. */
    reload: () => {
      setPages([]);
      setNextCursor(null);
      setHasNextPage(true);
      loadPage(null);
    },
  };
}
