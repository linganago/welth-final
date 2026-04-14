export function serializeTransaction(transaction) {
  return {
    ...transaction,
    amount: Number(transaction.amount),
  };
}

export function serializeAccount(account) {
  return {
    ...account,
    balance: Number(account.balance),
  };
}

export function serializeBudget(budget) {
  return {
    ...budget,
    amount: Number(budget.amount),
  };
}