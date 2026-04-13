"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Switch } from "../../../../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../../components/ui/popover";
import { Calendar } from "../../../../components/ui/calendar";
import { CreateAccountDrawer } from "../../../../components/create-account-drawer";
import { cn } from "../../../../lib/utils";
import { createTransaction, updateTransaction } from "../../../../actions/transaction";
import { transactionSchema } from "../../../../app/lib/schema";
import { ReceiptScanner } from "./receipt-scanner";
import useFetch from "../../../../hooks/use-fetch";

export function AddTransactionForm({
  accounts,
  categories,
  editMode = false,
  initialData = null,
  editId = null,
}) {
  const router = useRouter();

  // ── Idempotency key (create mode only) ─────────────────────────────────────
  const idempotencyKeyRef = useRef(null);
  useEffect(() => {
    if (editMode) return;
    const stored = sessionStorage.getItem("txn-idem-key");
    if (stored) {
      idempotencyKeyRef.current = stored;
    } else {
      const newKey = crypto.randomUUID();
      idempotencyKeyRef.current = newKey;
      sessionStorage.setItem("txn-idem-key", newKey);
    }
  }, [editMode]);

  // ── Form ───────────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    getValues,
    reset,
  } = useForm({
    resolver: zodResolver(transactionSchema),
    defaultValues:
      editMode && initialData
        ? {
            type: initialData.type,
            amount: initialData.amount.toString(),
            description: initialData.description ?? "",
            accountId: initialData.accountId,
            category: initialData.category,
            date: new Date(initialData.date),
            isRecurring: initialData.isRecurring,
            receiptUrl: initialData.receiptUrl ?? null,
            ...(initialData.recurringInterval && {
              recurringInterval: initialData.recurringInterval,
            }),
          }
        : {
            type: "EXPENSE",
            amount: "",
            description: "",
            accountId: accounts.find((ac) => ac.isDefault)?.id ?? "",
            date: new Date(),
            isRecurring: false,
            receiptUrl: null,
          },
  });

  // ── Server action ──────────────────────────────────────────────────────────
  const {
    loading: transactionLoading,
    fn: transactionFn,
    data: transactionResult,
  } = useFetch(editMode ? updateTransaction : createTransaction);

  const onSubmit = async (data) => {
    const formData = {
      ...data,
      amount: parseFloat(data.amount),
    };

    if (editMode) {
      await transactionFn(editId, formData);
    } else {
      await transactionFn(formData, idempotencyKeyRef.current);
    }
  };

  // ── Post-submit ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (transactionResult?.success && !transactionLoading) {
      if (transactionResult.idempotent) {
        toast.info("Transaction already recorded (duplicate request ignored).");
      } else {
        toast.success(
          editMode ? "Transaction updated successfully." : "Transaction created successfully."
        );
      }

      if (!editMode) {
        sessionStorage.removeItem("txn-idem-key");
        const newKey = crypto.randomUUID();
        idempotencyKeyRef.current = newKey;
        sessionStorage.setItem("txn-idem-key", newKey);
        reset();
      }

      router.push(`/account/${transactionResult.data.accountId}`);
    }
  }, [transactionResult, transactionLoading, editMode, reset, router]);

  // ── Receipt scan callback ──────────────────────────────────────────────────
  const handleScanComplete = (scannedData) => {
    if (!scannedData) return;
    if (scannedData.amount) setValue("amount", scannedData.amount.toString());
    if (scannedData.date) setValue("date", new Date(scannedData.date));
    if (scannedData.description) setValue("description", scannedData.description);
    if (scannedData.category) setValue("category", scannedData.category);
    // Persist the uploaded receipt URL so it gets stored with the transaction
    if (scannedData.receiptUrl) setValue("receiptUrl", scannedData.receiptUrl);
    toast.success("Receipt scanned — please review the pre-filled values.");
  };

  // ── Watched values ─────────────────────────────────────────────────────────
  const type = watch("type");
  const isRecurring = watch("isRecurring");
  const date = watch("date");
  const receiptUrl = watch("receiptUrl");

  const filteredCategories = categories.filter((c) => c.type === type);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {/* Receipt scanner */}
      {!editMode && <ReceiptScanner onScanComplete={handleScanComplete} />}

      {/* Receipt URL preview — shown after a scan */}
      {receiptUrl && (
        <div className="rounded-lg border p-3 bg-muted/40 flex items-center gap-3">
          <img
            src={receiptUrl}
            alt="Receipt preview"
            className="h-16 w-16 object-cover rounded-md border"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Receipt uploaded</p>
            <p className="text-xs text-muted-foreground truncate">{receiptUrl}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setValue("receiptUrl", null)}
          >
            Remove
          </Button>
        </div>
      )}

      {/* Type */}
      <div className="space-y-2">
        <label htmlFor="type-select" className="text-sm font-medium">Type</label>
        <Select onValueChange={(value) => setValue("type", value)} defaultValue={type}>
          <SelectTrigger id="type-select">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EXPENSE">Expense</SelectItem>
            <SelectItem value="INCOME">Income</SelectItem>
          </SelectContent>
        </Select>
        {errors.type && <p className="text-sm text-red-500" role="alert">{errors.type.message}</p>}
      </div>

      {/* Amount + Account */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="amount-input" className="text-sm font-medium">Amount</label>
          <Input id="amount-input" type="number" step="0.01" min="0" placeholder="0.00" {...register("amount")} />
          {errors.amount && <p className="text-sm text-red-500" role="alert">{errors.amount.message}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="account-select" className="text-sm font-medium">Account</label>
          <Select onValueChange={(value) => setValue("accountId", value)} defaultValue={getValues("accountId")}>
            <SelectTrigger id="account-select">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name} (${parseFloat(account.balance).toFixed(2)})
                </SelectItem>
              ))}
              <CreateAccountDrawer>
                <Button variant="ghost" className="w-full pl-8 text-left">+ Create Account</Button>
              </CreateAccountDrawer>
            </SelectContent>
          </Select>
          {errors.accountId && <p className="text-sm text-red-500" role="alert">{errors.accountId.message}</p>}
        </div>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <label htmlFor="category-select" className="text-sm font-medium">Category</label>
        <Select onValueChange={(value) => setValue("category", value)} defaultValue={getValues("category")}>
          <SelectTrigger id="category-select">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {filteredCategories.map((category) => (
              <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.category && <p className="text-sm text-red-500" role="alert">{errors.category.message}</p>}
      </div>

      {/* Date */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn("w-full pl-3 text-left font-normal", !date && "text-muted-foreground")}
              aria-label="Pick a date"
            >
              {date ? format(date, "PPP") : <span>Pick a date</span>}
              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => setValue("date", d)}
              disabled={(d) => d > new Date() || d < new Date("1900-01-01")}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {errors.date && <p className="text-sm text-red-500" role="alert">{errors.date.message}</p>}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label htmlFor="description-input" className="text-sm font-medium">Description</label>
        <Input id="description-input" placeholder="Enter description" {...register("description")} />
        {errors.description && <p className="text-sm text-red-500" role="alert">{errors.description.message}</p>}
      </div>

      {/* Recurring toggle */}
      <div className="flex flex-row items-center justify-between rounded-lg border p-4">
        <div>
          <label htmlFor="recurring-switch" className="text-base font-medium">Recurring Transaction</label>
          <p className="text-sm text-muted-foreground">Set a recurring schedule</p>
        </div>
        <Switch
          id="recurring-switch"
          checked={isRecurring}
          onCheckedChange={(checked) => setValue("isRecurring", checked)}
        />
      </div>

      {/* Recurring interval */}
      {isRecurring && (
        <div className="space-y-2">
          <label htmlFor="interval-select" className="text-sm font-medium">Recurring Interval</label>
          <Select onValueChange={(value) => setValue("recurringInterval", value)} defaultValue={getValues("recurringInterval")}>
            <SelectTrigger id="interval-select">
              <SelectValue placeholder="Select interval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DAILY">Daily</SelectItem>
              <SelectItem value="WEEKLY">Weekly</SelectItem>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="YEARLY">Yearly</SelectItem>
            </SelectContent>
          </Select>
          {errors.recurringInterval && (
            <p className="text-sm text-red-500" role="alert">{errors.recurringInterval.message}</p>
          )}
        </div>
      )}

      {/* Submit / Cancel */}
      <div className="flex gap-4">
        <Button type="button" variant="outline" className="w-full" onClick={() => router.back()} disabled={transactionLoading}>
          Cancel
        </Button>
        <Button type="submit" className="w-full" disabled={transactionLoading}>
          {transactionLoading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />{editMode ? "Updating…" : "Creating…"}</>
          ) : editMode ? "Update Transaction" : "Create Transaction"}
        </Button>
      </div>
    </form>
  );
}
