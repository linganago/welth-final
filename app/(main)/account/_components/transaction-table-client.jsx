"use client";

import dynamic from "next/dynamic";
import { BarLoader } from "react-spinners";

/**
 * Lazy-loads the transaction table on the client only (ssr: false) so the
 * IntersectionObserver API (used by useInfiniteTransactions) is always
 * available and we avoid SSR hydration mismatches.
 *
 * Props:
 *   accountId  – passed through to TransactionTable so it can drive the
 *                paginated server-action calls.
 */
const TransactionTable = dynamic(() => import("./transaction-table"), {
  ssr: false,
  loading: () => (
    <BarLoader className="mt-4" width="100%" color="#9333ea" />
  ),
});

export default function TransactionTableClient({ accountId }) {
  return <TransactionTable accountId={accountId} />;
}
