// Pure derivation functions over the immutable transaction log.
// Nothing in here mutates state — every balance is computed fresh from
// `transactions`, so the UI can never show numbers that drift from the log.

import { Transaction, UNALLOCATED, BUFFER, CREDIT_CARD, Category } from "./types";

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

/** How much is currently owed on the credit card, as a positive number.
 * The account balance itself is <= 0 (more negative = more debt), so this
 * just flips the sign for display purposes. */
export function creditCardDebt(transactions: Transaction[]): number {
  return round2(-accountBalance(transactions, CREDIT_CARD));
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

/** Total cash actually sitting in the account right now.
 *
 * Only accounts that still hold real money count: unallocated cash plus the
 * savings buffer. Ordinary category accounts are deliberately excluded —
 * they accumulate what has already been *spent* in that category, so adding
 * them back would cancel out the cash the expense removed and leave the
 * total unchanged after every purchase. */
export function totalCashOnHand(transactions: Transaction[], categories: Category[]): number {
  let total = unallocatedCash(transactions);
  for (const c of categories) {
    if (c.isBuffer) total += accountBalance(transactions, c.id);
  }
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

/** Total outflow recorded by a transaction — the sum of all its negative
 * postings. For a plain spend (one posting) this is just that posting; for
 * an allocate/spend that's partly covered by debt (two negative postings:
 * the real-cash side and the debt side), summing both gives the full amount
 * the user actually spent, regardless of how it was funded. */
export function transactionOutflow(tx: Transaction): number {
  return round2(-tx.postings.filter((p) => p.amount < 0).reduce((sum, p) => sum + p.amount, 0));
}

/** Signed effect of a manual "adjustment" transaction on the category's
 * spend total: increasing the category's balance counts as more spend,
 * decreasing it counts as less — unlike spend/allocate, this can go either
 * way, so we read the actual signed posting on that category rather than
 * transactionOutflow() (which only ever sums negative postings). */
export function adjustmentEffect(tx: Transaction): { categoryId: string; amount: number } | null {
  if (tx.type !== "adjustment") return null;
  const categoryId = tx.meta?.categoryId;
  if (!categoryId) return null;
  const posting = tx.postings.find((p) => p.account === categoryId);
  if (!posting) return null;
  return { categoryId, amount: posting.amount };
}

/** True for anything that changes what a category has spent — the expenses
 * themselves plus manual corrections to them. Used by the dashboard's expense
 * list so a corrected amount shows up there, not just in the totals. */
export function affectsCategorySpend(tx: Transaction): boolean {
  if (tx.type === "spend" || tx.type === "allocate") return true;
  return adjustmentEffect(tx) !== null;
}

/** Signed amount an expense-ish transaction moves, from the wallet's point of
 * view: negative when money went out, positive when a correction gave some
 * back. */
export function expenseSignedAmount(tx: Transaction): number {
  const adj = adjustmentEffect(tx);
  if (adj) return round2(-adj.amount);
  return round2(-transactionOutflow(tx));
}

/** The current month as `yyyy-mm`, matching the prefix of a transaction date.
 * Uses local time, not UTC, so "this month" means the user's month. */
export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Total spend per category (spend/allocate transactions, plus manual
 * balance corrections), for the expense-distribution pie chart. Keyed by
 * category id. Pass `month` as `yyyy-mm` to count only that month. */
export function categoryExpenseTotals(
  transactions: Transaction[],
  month?: string
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const tx of transactions) {
    if (month && !tx.date.startsWith(month)) continue;
    if (tx.type === "spend" || tx.type === "allocate") {
      const categoryId = tx.meta?.categoryId;
      if (!categoryId) continue;
      map[categoryId] = round2((map[categoryId] ?? 0) + transactionOutflow(tx));
      continue;
    }
    const adj = adjustmentEffect(tx);
    if (adj) {
      map[adj.categoryId] = round2((map[adj.categoryId] ?? 0) + adj.amount);
    }
  }
  return map;
}

export function monthlyExpenseTotals(transactions: Transaction[]): MonthlyIncome[] {
  const map = new Map<string, MonthlyIncome>();
  for (const tx of transactions) {
    let amt: number | null = null;
    if (tx.type === "spend" || tx.type === "allocate") {
      amt = transactionOutflow(tx);
    } else {
      const adj = adjustmentEffect(tx);
      if (adj) amt = adj.amount;
    }
    if (amt === null) continue;
    const month = tx.date.slice(0, 7);
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

export type CurrencyCode = "TRY" | "USD" | "EUR";

// The display currency, held at module level so the ~30 formatCurrency() call
// sites don't each have to thread it through. lib/currency.tsx owns the user's
// choice and pushes it here; amounts themselves are stored as plain numbers and
// are never converted — changing this only changes the symbol the figures are
// shown with.
let activeCurrency: CurrencyCode = "TRY";

export function setActiveCurrency(currency: CurrencyCode): void {
  activeCurrency = currency;
}

export function getActiveCurrency(): CurrencyCode {
  return activeCurrency;
}

export function formatCurrency(amount: number, currency: CurrencyCode = activeCurrency): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
  }).format(amount);
}

/** Short form for tight spaces — "₺12,5B" instead of "₺12.500,00". Used for the
 * per-bar labels in the trend charts, where six full amounts can't fit across a
 * phone screen. */
export function formatCurrencyCompact(amount: number, currency: CurrencyCode = activeCurrency): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    notation: "compact",
    // minimum 0 drops the trailing ",0" that currency style would otherwise
    // force on round values ("₺850" rather than "₺850,0").
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(amount);
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Normalized form used to compare category names for duplicates. Trims and
 * collapses inner whitespace, and lowercases with Turkish rules so "Kira" and
 * "KİRA" are recognised as the same name (a plain toLowerCase() maps "İ" to
 * "i̇" — an i with a combining dot — and would miss the match). */
export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr");
}

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
