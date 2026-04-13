"use client";

import { useState, useMemo, useCallback, useOptimistic, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Trash,
  Search,
  X,
  RefreshCw,
  Clock,
  Loader2,
  Receipt,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import Image from "next/image";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import { Input } from "../../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../../../../components/ui/dropdown-menu";
import { Checkbox } from "../../../../components/ui/checkbox";
import { Button } from "../../../../components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../../components/ui/tooltip";
import { Badge } from "../../../../components/ui/badge";
import { cn } from "../../../../lib/utils";
import { categoryColors } from "../../../../data/categories";
import { bulkDeleteTransactions } from "../../../../actions/account";
import { useInfiniteTransactions } from "../../../../hooks/use-infinite-transactions";
import { BarLoader } from "react-spinners";
import { useRouter } from "next/navigation";

const RECURRING_INTERVALS = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

// ---------------------------------------------------------------------------
// Optimistic reducer — describes how the UI state changes before server confirms
// ---------------------------------------------------------------------------
function optimisticReducer(state, action) {
  switch (action.type) {
    case "DELETE":
      // Immediately remove the deleted ids from the visible list
      return state.filter((t) => !action.ids.includes(t.id));
    case "RESET":
      // Server confirmed — replace with fresh data
      return action.transactions;
    default:
      return state;
  }
}

function TransactionTable({ accountId }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ── Filters ──────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [recurringFilter, setRecurringFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ field: "date", direction: "desc" });
  const [selectedIds, setSelectedIds] = useState([]);

  // ── Infinite scroll ───────────────────────────────────────────────────────
  const { transactions: fetchedTransactions, isLoading, hasNextPage, sentinelRef, reload } =
    useInfiniteTransactions({
      accountId,
      pageSize: 20,
      ...(typeFilter && { type: typeFilter }),
      ...(recurringFilter && { recurringFilter }),
      ...(searchTerm && { searchTerm }),
    });

  // ── Optimistic state ──────────────────────────────────────────────────────
  // useOptimistic gives us a local copy of transactions that can be mutated
  // instantly (before the server responds).  If the server action fails,
  // React automatically reverts to `fetchedTransactions`.
  const [optimisticTransactions, dispatchOptimistic] = useOptimistic(
    fetchedTransactions,
    optimisticReducer
  );

  // ── Sort (client-side on loaded page) ────────────────────────────────────
  const sortedTransactions = useMemo(() => {
  // ✅ STEP 1: REMOVE DUPLICATES FIRST
  const unique = Array.from(
    new Map(optimisticTransactions.map((t) => [t.id, t])).values()
  );

  // ✅ STEP 2: SORT
  unique.sort((a, b) => {
    let cmp = 0;

    switch (sortConfig.field) {
      case "date":
        cmp = new Date(a.date) - new Date(b.date);
        break;
      case "amount":
        cmp = a.amount - b.amount;
        break;
      case "category":
        cmp = a.category.localeCompare(b.category);
        break;
      default:
        cmp = 0;
    }

    return sortConfig.direction === "asc" ? cmp : -cmp;
  });

  return unique;
}, [optimisticTransactions, sortConfig]);

  const handleSort = useCallback((field) => {
    setSortConfig((cur) => ({
      field,
      direction: cur.field === field && cur.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  // ── Selection ─────────────────────────────────────────────────────────────
  const handleSelect = useCallback((id) => {
    setSelectedIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds((cur) =>
      cur.length === sortedTransactions.length
        ? []
        : sortedTransactions.map((t) => t.id)
    );
  }, [sortedTransactions]);

  // ── Optimistic delete ─────────────────────────────────────────────────────
  const handleDelete = useCallback(async (ids) => {
    if (!ids.length) return;

    // 1. Instantly remove from UI — user sees the result before server responds
    startTransition(() => {
      dispatchOptimistic({ type: "DELETE", ids });
    });

    // Clear selection immediately
    setSelectedIds([]);

    try {
      const result = await bulkDeleteTransactions(ids);
      if (result?.success) {
        toast.success(
          ids.length === 1
            ? "Transaction deleted."
            : `${ids.length} transactions deleted.`
        );
        // Reload to sync with server state
        reload();
      } else {
        // Server rejected — optimistic state is automatically reverted by React
        toast.error(result?.error ?? "Delete failed. Please try again.");
      }
    } catch {
      toast.error("Delete failed. Please try again.");
    }
  }, [dispatchOptimistic, reload]);

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (
      !window.confirm(
        `Delete ${selectedIds.length} transaction${selectedIds.length === 1 ? "" : "s"}? This cannot be undone.`
      )
    ) return;
    await handleDelete(selectedIds);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const hasActiveFilters = searchTerm || typeFilter || recurringFilter;

  const SortIcon = ({ field }) => {
    if (sortConfig.field !== field) return null;
    return sortConfig.direction === "asc"
      ? <ChevronUp className="ml-1 h-4 w-4" />
      : <ChevronDown className="ml-1 h-4 w-4" />;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Loading bar — shown during pending server transitions */}
      {isPending && (
        <BarLoader className="mt-4" width={"100%"} color="#9333ea" />
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setSelectedIds([]); }}
            className="pl-8"
            aria-label="Search transactions"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Select
            value={typeFilter}
            onValueChange={(v) => { setTypeFilter(v); setSelectedIds([]); }}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INCOME">Income</SelectItem>
              <SelectItem value="EXPENSE">Expense</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={recurringFilter}
            onValueChange={(v) => { setRecurringFilter(v); setSelectedIds([]); }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Transactions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recurring">Recurring Only</SelectItem>
              <SelectItem value="non-recurring">One-time Only</SelectItem>
            </SelectContent>
          </Select>

          {selectedIds.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isPending}
              aria-label={`Delete ${selectedIds.length} selected transactions`}
            >
              <Trash className="h-4 w-4 mr-2" />
              Delete ({selectedIds.length})
            </Button>
          )}

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setSearchTerm("");
                setTypeFilter("");
                setRecurringFilter("");
                setSelectedIds([]);
              }}
              aria-label="Clear all filters"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border" role="region" aria-label="Transactions">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={
                    sortedTransactions.length > 0 &&
                    selectedIds.length === sortedTransactions.length
                  }
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all visible transactions"
                />
              </TableHead>

              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("date")}
              >
                <div className="flex items-center">
                  Date <SortIcon field="date" />
                </div>
              </TableHead>

              <TableHead>Description</TableHead>

              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("category")}
              >
                <div className="flex items-center">
                  Category <SortIcon field="category" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => handleSort("amount")}
              >
                <div className="flex items-center justify-end">
                  Amount <SortIcon field="amount" />
                </div>
              </TableHead>

              <TableHead>Recurring</TableHead>
              <TableHead className="w-[60px]">Receipt</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {sortedTransactions.length === 0 && !isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground py-8"
                >
                  {hasActiveFilters
                    ? "No transactions match your filters."
                    : "No transactions yet."}
                </TableCell>
              </TableRow>
            ) : (
              sortedTransactions.map((t) => (
                <TableRow
                  key={`${t.id}-${t.date}`}
                  className={cn(
                    "transition-opacity duration-200",
                    // Visually dim rows that are being optimistically deleted
                    isPending && selectedIds.includes(t.id) && "opacity-40"
                  )}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(t.id)}
                      onCheckedChange={() => handleSelect(t.id)}
                      aria-label={`Select transaction ${t.description ?? t.id}`}
                    />
                  </TableCell>

                  <TableCell className="whitespace-nowrap">
                    {format(new Date(t.date), "PP")}
                  </TableCell>

                  <TableCell className="max-w-[180px] truncate">
                    {t.description}
                  </TableCell>

                  <TableCell className="capitalize">
                    <span
                      style={{ background: categoryColors[t.category] }}
                      className="px-2 py-1 rounded text-white text-sm"
                    >
                      {t.category}
                    </span>
                  </TableCell>

                  <TableCell
                    className={cn(
                      "text-right font-medium tabular-nums",
                      t.type === "EXPENSE" ? "text-red-500" : "text-green-500"
                    )}
                  >
                    {t.type === "EXPENSE" ? "-" : "+"}$
                    {Number(t.amount).toFixed(2)}
                  </TableCell>

                  <TableCell>
                    {t.isRecurring ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="secondary"
                              className="gap-1 bg-purple-100 text-purple-700 hover:bg-purple-200 cursor-default"
                            >
                              <RefreshCw className="h-3 w-3" />
                              {RECURRING_INTERVALS[t.recurringInterval]}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-sm">
                              <div className="font-medium">Next Date:</div>
                              <div>
                                {t.nextRecurringDate
                                  ? format(new Date(t.nextRecurringDate), "PPP")
                                  : "N/A"}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        One-time
                      </Badge>
                    )}
                  </TableCell>

                  {/* Receipt thumbnail */}
                  <TableCell>
                    {t.receiptUrl ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a
                              href={t.receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="View receipt"
                              className="inline-flex items-center justify-center w-8 h-8 rounded-md border hover:bg-muted transition-colors"
                            >
                              <Receipt className="h-4 w-4 text-muted-foreground" />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent
                            side="left"
                            className="p-0 overflow-hidden rounded-lg"
                          >
                            <Image
                              src={t.receiptUrl}
                              alt="Receipt preview"
                              width={200}
                              height={200}
                              className="object-cover"
                            />
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          aria-label={`Actions for transaction ${t.description ?? t.id}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/transaction/create?edit=${t.id}`)
                          }
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete([t.id])}
                          disabled={isPending}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Infinite scroll sentinel */}
      <div
        ref={sentinelRef}
        className="flex items-center justify-center py-4"
        aria-hidden="true"
      >
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading more transactions…
          </div>
        )}
        {!isLoading && !hasNextPage && sortedTransactions.length > 0 && (
          <p className="text-sm text-muted-foreground">
            All transactions loaded.
          </p>
        )}
      </div>
    </div>
  );
}

export default TransactionTable;
