import { getUserAccounts } from "../../../../actions/dashboard";
import { getTransaction } from "../../../../actions/transaction";
import { defaultCategories } from "../../../../data/categories";
import { AddTransactionForm } from "../_components/transaction-form";

export default async function AddTransactionPage({ searchParams }) {
  const editId =  searchParams?.edit || null;
  const accounts = await getUserAccounts();

  let initialData = null;
  if (editId) {
    initialData = await getTransaction(editId);
  }

  return (
    <div className="max-w-3xl mx-auto px-5">
      <h1 className="text-4xl font-bold mb-6">
        {editId ? "Edit Transaction" : "Create Transaction"}
      </h1>
      <AddTransactionForm
        accounts={accounts}
        categories={defaultCategories}
        editMode={!!editId}
        initialData={initialData}
        editId={editId}
      />
    </div>
  );
}