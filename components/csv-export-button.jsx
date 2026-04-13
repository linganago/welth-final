"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { exportTransactionsCSV } from "../actions/transaction";

/**
 * CSVExportButton
 * ---------------
 * Calls the exportTransactionsCSV server action, receives a CSV string,
 * and triggers a browser file download — all without a full page navigation.
 *
 * Props:
 *   accountId  – optional, filters to a single account
 *   startDate  – optional ISO date string
 *   endDate    – optional ISO date string
 *   label      – button label (default "Export CSV")
 */
export function CSVExportButton({
  accountId,
  startDate,
  endDate,
  label = "Export CSV",
}) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const result = await exportTransactionsCSV({ accountId, startDate, endDate });

      if (!result.success) {
        toast.error("Export failed. Please try again.");
        return;
      }

      if (result.count === 0) {
        toast.info("No transactions found for the selected filters.");
        return;
      }

      // Build a filename with today's date
      const today = new Date().toISOString().split("T")[0];
      const filename = accountId
        ? `transactions-${accountId.slice(0, 8)}-${today}.csv`
        : `transactions-${today}.csv`;

      // Create a Blob and trigger browser download
      const blob = new Blob([result.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${result.count} transactions.`);
    } catch (err) {
      toast.error(err?.message ?? "Export failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={loading}
      aria-label="Export transactions as CSV"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />
      ) : (
        <Download className="h-4 w-4 mr-2" aria-hidden />
      )}
      {loading ? "Exporting…" : label}
    </Button>
  );
}
