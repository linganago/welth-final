export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { getUserAccounts } from "../../../actions/dashboard";
import { getDashboardData } from "../../../actions/dashboard";
import { getCurrentBudget, getAllBudgetsWithProgress } from "../../../actions/budget";
import { AccountCard } from "./_components/account-card";
import { CreateAccountDrawer } from "../../../components/create-account-drawer";
import { BudgetProgress } from "./_components/budget-progress";
import { BudgetManager } from "./_components/budget-manager";
import { Card, CardContent } from "../../../components/ui/card";
import { Plus } from "lucide-react";
import { DashboardOverview } from "./_components/transaction-overview";
import { CSVExportButton } from "../../../components/csv-export-button";

export default async function DashboardPage() {
  const [accounts, transactions, allBudgets] = await Promise.all([
    getUserAccounts(),
    getDashboardData(),
    getAllBudgetsWithProgress(),
  ]);

  const defaultAccount = accounts?.find((account) => account.isDefault);

  // Global budget for the legacy progress bar
  let budgetData = null;
  if (defaultAccount) {
    budgetData = await getCurrentBudget(defaultAccount.id);
  }

  return (
    <div className="space-y-8">
      {/* Legacy global budget progress bar */}
      <BudgetProgress
        initialBudget={budgetData?.budget}
        currentExpenses={budgetData?.currentExpenses || 0}
      />

      {/* Per-category budget manager */}
      <BudgetManager initialBudgets={allBudgets} />

      {/* Dashboard Overview */}
      <DashboardOverview
        accounts={accounts}
        transactions={transactions || []}
      />

      {/* Accounts Grid */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Your Accounts</h2>
        <CSVExportButton label="Export All Transactions" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <CreateAccountDrawer>
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-dashed">
            <CardContent className="flex flex-col items-center justify-center text-muted-foreground h-full pt-5">
              <Plus className="h-10 w-10 mb-2" />
              <p className="text-sm font-medium">Add New Account</p>
            </CardContent>
          </Card>
        </CreateAccountDrawer>
        {accounts.length > 0 &&
          accounts?.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
      </div>
    </div>
  );
}
