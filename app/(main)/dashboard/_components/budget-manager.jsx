"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Check, X, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import useFetch from "../../../../hooks/use-fetch";
import {
  upsertBudget,
  deleteBudget,
  getAllBudgetsWithProgress,
} from "../../../../actions/budget";
import { defaultCategories } from "../../../../data/categories";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Progress } from "../../../../components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";
import { cn } from "../../../../lib/utils";

const EXPENSE_CATEGORIES = defaultCategories.filter((c) => c.type === "EXPENSE");

// ---------------------------------------------------------------------------
// Inline editor — appears in place of a budget row when editing
// ---------------------------------------------------------------------------
function BudgetEditor({ budget, onSave, onCancel }) {
  const [amount, setAmount] = useState(budget?.amount?.toString() ?? "");

  const handleSave = () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Enter a valid positive amount.");
      return;
    }
    onSave(parsed);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 max-w-[160px]">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
          $
        </span>
        <Input
          type="number"
          min="1"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="pl-6"
          placeholder="0"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") onCancel();
          }}
        />
      </div>
      <Button variant="ghost" size="icon" onClick={handleSave} aria-label="Save budget">
        <Check className="h-4 w-4 text-green-500" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Cancel">
        <X className="h-4 w-4 text-red-500" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single budget row
// ---------------------------------------------------------------------------
function BudgetRow({ budget, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false);

  const label = budget.category ?? "Overall (Global)";
  const color =
    budget.percentage >= 100
      ? "bg-red-500"
      : budget.percentage >= 80
      ? "bg-yellow-500"
      : "bg-green-500";

  const handleSave = async (newAmount) => {
    await onUpdate(budget.category, newAmount);
    setEditing(false);
  };

  return (
    <div className="space-y-1 py-3 border-b last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate capitalize">{label}</span>
          {budget.isOverBudget && (
            <span className="text-xs text-red-500 font-medium shrink-0">Over budget</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {editing ? (
            <BudgetEditor
              budget={budget}
              onSave={handleSave}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <span className="text-sm text-muted-foreground mr-2">
                ${budget.spent.toFixed(0)} / ${budget.amount.toFixed(0)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setEditing(true)}
                aria-label={`Edit ${label} budget`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => onDelete(budget.id)}
                aria-label={`Delete ${label} budget`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Progress
          value={budget.percentage}
          className="h-2 flex-1"
          indicatorClassName={color}
        />
        <span className="text-xs text-muted-foreground w-10 text-right">
          {budget.percentage.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add-new-budget form
// ---------------------------------------------------------------------------
function AddBudgetForm({ existingCategories, onAdd, onCancel }) {
  const [selectedCategory, setSelectedCategory] = useState("__global__");
  const [amount, setAmount] = useState("");

  const availableCategories = EXPENSE_CATEGORIES.filter(
    (c) => !existingCategories.includes(c.id)
  );
  const globalTaken = existingCategories.includes(null);

  const handleAdd = () => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Enter a valid positive amount.");
      return;
    }
    if (selectedCategory === "__global__" && globalTaken) {
      toast.error("A global budget already exists. Edit it instead.");
      return;
    }
    onAdd(
      selectedCategory === "__global__" ? null : selectedCategory,
      parsed
    );
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="flex gap-2">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {!globalTaken && (
              <SelectItem value="__global__">Overall (Global)</SelectItem>
            )}
            {availableCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
            {availableCategories.length === 0 && globalTaken && (
              <SelectItem value="__none__" disabled>
                All categories budgeted
              </SelectItem>
            )}
          </SelectContent>
        </Select>

        <div className="relative w-32">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            $
          </span>
          <Input
            type="number"
            min="1"
            step="1"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pl-6"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") onCancel();
            }}
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleAdd}>
          Add Budget
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main BudgetManager component
// ---------------------------------------------------------------------------
export function BudgetManager({ initialBudgets = [] }) {
  const [budgets, setBudgets] = useState(initialBudgets);
  const [showAddForm, setShowAddForm] = useState(false);

  const { loading: upserting, fn: upsertFn } = useFetch(upsertBudget);
  const { loading: deleting, fn: deleteFn } = useFetch(deleteBudget);

  // Refresh budgets from server after any mutation
  const refreshBudgets = async () => {
    try {
      const fresh = await getAllBudgetsWithProgress();
      setBudgets(fresh);
    } catch {
      // silently ignore — user will see stale data until next navigation
    }
  };

  const handleAdd = async (category, amount) => {
    const result = await upsertFn({ category, amount });
    if (result?.success) {
      toast.success("Budget added.");
      setShowAddForm(false);
      await refreshBudgets();
    } else {
      toast.error(result?.error ?? "Failed to add budget.");
    }
  };

  const handleUpdate = async (category, amount) => {
    const result = await upsertFn({ category, amount });
    if (result?.success) {
      toast.success("Budget updated.");
      await refreshBudgets();
    } else {
      toast.error(result?.error ?? "Failed to update budget.");
    }
  };

  const handleDelete = async (budgetId) => {
    if (!window.confirm("Delete this budget?")) return;
    const result = await deleteFn(budgetId);
    if (result?.success) {
      toast.success("Budget deleted.");
      await refreshBudgets();
    } else {
      toast.error(result?.error ?? "Failed to delete budget.");
    }
  };

  const existingCategories = budgets.map((b) => b.category);

  const totalBudgeted = budgets.find((b) => b.category === null)?.amount ?? 0;
  const totalSpent = budgets.find((b) => b.category === null)?.spent ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Budget Tracker
          </CardTitle>
          {totalBudgeted > 0 && (
            <CardDescription className="mt-1">
              ${totalSpent.toFixed(0)} spent of ${totalBudgeted.toFixed(0)} global budget this month
            </CardDescription>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(true)}
          disabled={showAddForm || upserting || deleting}
          aria-label="Add new budget"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Budget
        </Button>
      </CardHeader>

      <CardContent className="space-y-1">
        {showAddForm && (
          <div className="mb-3">
            <AddBudgetForm
              existingCategories={existingCategories}
              onAdd={handleAdd}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        )}

        {budgets.length === 0 && !showAddForm ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <p>No budgets set yet.</p>
            <p className="mt-1">Click "Add Budget" to get started.</p>
          </div>
        ) : (
          budgets.map((budget) => (
            <BudgetRow
              key={budget.id}
              budget={budget}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
