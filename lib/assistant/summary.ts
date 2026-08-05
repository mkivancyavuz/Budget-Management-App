// Builds the financial picture handed to the assistant.
//
// Every figure here is computed by the app's own ledger functions — the model
// never adds anything up. Asking a language model to do arithmetic over a list
// of transactions produces confident, plausible, wrong totals; letting it only
// interpret numbers we calculated removes that failure mode entirely.
//
// This is also the privacy boundary: by default the assistant sees aggregates
// only. Client names and note text stay out of it unless the model explicitly
// asks for detail through the transactions tool.
import type { Category, Transaction } from "@/lib/types";
import {
  accountBalance,
  categoryDisplayName,
  categoryExpenseTotals,
  creditCardDebt,
  currentMonthKey,
  monthlyIncomeTotals,
  monthlyExpenseTotals,
  monthlyProfitTotals,
  unallocatedCash,
  round2,
} from "@/lib/ledger";

export interface AssistantSummary {
  currency: string;
  today: string;
  currentMonth: string;
  availableCash: number;
  debt: number;
  categories: { name: string; spentThisMonth: number; spentAllTime: number }[];
  monthly: { month: string; income: number; expense: number; profit: number }[];
  totals: { incomeAllTime: number; expenseAllTime: number };
  transactionCount: number;
}

/** Plain-language identity for a category, since ids mean nothing to the model. */
type Translate = (key: string, params?: Record<string, string | number>) => string;

export function buildSummary(
  transactions: Transaction[],
  categories: Category[],
  currency: string,
  t: Translate
): AssistantSummary {
  const month = currentMonthKey();
  const thisMonthTotals = categoryExpenseTotals(transactions, month);
  const allTimeTotals = categoryExpenseTotals(transactions);

  const income = monthlyIncomeTotals(transactions);
  const expense = monthlyExpenseTotals(transactions);
  const profit = monthlyProfitTotals(transactions);
  const expenseByMonth = new Map(expense.map((m) => [m.month, m.total]));
  const incomeByMonth = new Map(income.map((m) => [m.month, m.total]));

  return {
    currency,
    today: new Date().toISOString().slice(0, 10),
    currentMonth: month,
    availableCash: unallocatedCash(transactions),
    debt: creditCardDebt(transactions),
    categories: categories
      .filter((c) => !c.archived)
      .map((c) => ({
        name: categoryDisplayName(c, t),
        spentThisMonth: thisMonthTotals[c.id] ?? 0,
        spentAllTime: allTimeTotals[c.id] ?? 0,
      })),
    // Last 12 months is plenty of context and keeps the payload small.
    monthly: profit.slice(-12).map((m) => ({
      month: m.month,
      income: incomeByMonth.get(m.month) ?? 0,
      expense: expenseByMonth.get(m.month) ?? 0,
      profit: m.profit,
    })),
    totals: {
      incomeAllTime: round2(income.reduce((s, m) => s + m.total, 0)),
      expenseAllTime: round2(expense.reduce((s, m) => s + m.total, 0)),
    },
    transactionCount: transactions.length,
  };
}

/** Categories the assistant may reference when proposing an expense, plus the
 * balances it might be asked about. Kept separate so the proposal tools can
 * validate a category name without pulling the whole summary. */
export function categoryIndex(categories: Category[], t: Translate) {
  return categories
    .filter((c) => !c.archived)
    .map((c) => ({ id: c.id, name: categoryDisplayName(c, t) }));
}

export function categoryBalance(transactions: Transaction[], categoryId: string): number {
  return accountBalance(transactions, categoryId);
}
