// Pure derivation functions over the immutable transaction log.
// Nothing in here mutates state — every balance is computed fresh from
// `transactions`, so the UI can never show numbers that drift from the log.

import { Transaction, UNALLOCATED, BUFFER, Category } from "./types";

/** Sum of all postings for a given account (unallocated, buffer, or a category id). */
export function accountBalance(transactions: Transaction[], account: string): number {
  let total = 0;
  for (const tx of transactions) {
    for (const p of tx.postings) {
      if (p.account === account) total += p.amount;
    }
  }
  return round2(total);
}

export function unallocatedCash(transactions: Transaction[]): number {
  return accountBalance(transactions, UNALLOCATED);
}

export function bufferBalance(transactions: Transaction[]): number {
  return accountBalance(transactions, BUFFER);
}

export function categoryBalances(
  transactions: Transaction[],
  categories: Category[]
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of categories) {
    map[c.id] = accountBalance(transactions, c.id);
  }
  return map;
}

/** Total cash actually sitting in the account right now (sanity check total). */
export function totalCashOnHand(transactions: Transaction[], categories: Category[]): number {
  let total = unallocatedCash(transactions);
  for (const c of categories) total += accountBalance(transactions, c.id);
  return round2(total);
}

export interface MonthlyIncome {
  month: string; // yyyy-mm
  total: number;
  count: number;
}

export function monthlyIncomeTotals(transactions: Transaction[]): MonthlyIncome[] {
  const map = new Map<string, MonthlyIncome>();
  for (const tx of transactions) {
    if (tx.type !== "income" && tx.type !== "initial_balance") continue;
    if (tx.type === "initial_balance") continue; // don't count starting balance as "income"
    const month = tx.date.slice(0, 7);
    const amt = tx.postings.find((p) => p.account === UNALLOCATED)?.amount ?? 0;
    const existing = map.get(month);
    if (existing) {
      existing.total = round2(existing.total + amt);
      existing.count += 1;
    } else {
      map.set(month, { month, total: round2(amt), count: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export function monthlyExpenseTotals(transactions: Transaction[]): MonthlyIncome[] {
  const map = new Map<string, MonthlyIncome>();
  for (const tx of transactions) {
    if (tx.type !== "spend" && tx.type !== "allocate") continue;
    const month = tx.date.slice(0, 7);
    const outgoing = tx.postings.find((p) => p.amount < 0);
    const amt = outgoing ? -outgoing.amount : 0;
    const existing = map.get(month);
    if (existing) {
      existing.total = round2(existing.total + amt);
      existing.count += 1;
    } else {
      map.set(month, { month, total: round2(amt), count: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export interface MonthlyProfit {
  month: string; // yyyy-mm
  income: number;
  expense: number;
  profit: number; // income - expense, can be negative
}

export function monthlyProfitTotals(transactions: Transaction[]): MonthlyProfit[] {
  const income = monthlyIncomeTotals(transactions);
  const expense = monthlyExpenseTotals(transactions);
  const months = new Set<string>([...income.map((m) => m.month), ...expense.map((m) => m.month)]);
  const incomeMap = new Map(income.map((m) => [m.month, m.total]));
  const expenseMap = new Map(expense.map((m) => [m.month, m.total]));
  return Array.from(months)
    .sort((a, b) => a.localeCompare(b))
    .map((month) => {
      const inc = incomeMap.get(month) ?? 0;
      const exp = expenseMap.get(month) ?? 0;
      return { month, income: inc, expense: exp, profit: round2(inc - exp) };
    });
}

export interface IncomeInsights {
  months: MonthlyIncome[];
  average: number;
  best: MonthlyIncome | null;
  worst: MonthlyIncome | null;
  daysSinceLastIncome: number | null;
}

export function computeIncomeInsights(transactions: Transaction[]): IncomeInsights {
  const months = monthlyIncomeTotals(transactions);
  const average = months.length
    ? round2(months.reduce((s, m) => s + m.total, 0) / months.length)
    : 0;
  let best: MonthlyIncome | null = null;
  let worst: MonthlyIncome | null = null;
  for (const m of months) {
    if (!best || m.total > best.total) best = m;
    if (!worst || m.total < worst.total) worst = m;
  }

  const incomeTxs = transactions
    .filter((t) => t.type === "income")
    .sort((a, b) => b.date.localeCompare(a.date));
  let daysSinceLastIncome: number | null = null;
  if (incomeTxs.length > 0) {
    const last = new Date(incomeTxs[0].date);
    const now = new Date();
    daysSinceLastIncome = Math.floor((now.getTime() - last.getTime()) / 86400000);
  }

  return { months, average, best, worst, daysSinceLastIncome };
}

export type BufferStatus = "Healthy" | "Low" | "Critical" | "No Target Set";

export function bufferStatus(
  balance: number,
  target: number,
  criticalPct: number,
  lowPct: number
): BufferStatus {
  if (target <= 0) return "No Target Set";
  const pct = (balance / target) * 100;
  if (pct < criticalPct) return "Critical";
  if (pct < lowPct) return "Low";
  return "Healthy";
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(amount: number, currency = "TRY"): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
  }).format(amount);
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Display name for a category — follows the current language for built-in/demo
 * categories (those with a `nameKey`), falls back to the stored free-text name
 * for anything the user typed themselves. */
export function categoryDisplayName(category: Pick<Category, "name" | "nameKey">, t: Translate): string {
  if (category.nameKey) return t(category.nameKey);
  return category.name;
}

/** Renders a transaction's label, re-resolving any category name(s) referenced in
 * meta against the current category list so translated/renamed categories show
 * correctly everywhere the transaction is displayed — while the ledger itself
 * stays an immutable log of category ids and postings. */
export function renderTransactionLabel(tx: Transaction, categories: Category[], t: Translate): string {
  const params: Record<string, string> = { ...(tx.labelParams ?? {}) };
  const nameFor = (id?: string): string | undefined => {
    if (!id) return undefined;
    const cat = categories.find((c) => c.id === id);
    return cat ? categoryDisplayName(cat, t) : undefined;
  };
  const category = nameFor(tx.meta?.categoryId);
  if (category) params.category = category;
  const from = nameFor(tx.meta?.fromCategoryId);
  if (from) params.from = from;
  const to = nameFor(tx.meta?.toCategoryId);
  if (to) params.to = to;
  return t(tx.labelKey, params);
}
