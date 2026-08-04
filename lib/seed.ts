import { AppState, Transaction, UNALLOCATED } from "./types";
import { newId } from "./ledger";

// Demo seed data so the prototype is meaningful to explore. Illustrates
// irregular freelancer income: a burst of payments, then a dry spell.
// Loaded only when the user explicitly clicks "Load demo data" — the app
// otherwise starts empty so it never shows numbers the user didn't enter.
const CATEGORY_NAMES: Record<string, string> = {
  rent: "Kira",
  taxes: "Vergi (ayrılan)",
  groceries: "Market",
  software: "Yazılım & Abonelikler",
};

export function buildSeedState(): AppState {
  // monthlyTarget is 0, matching every category the app itself creates — the
  // dashboard shows what a category cost this month, not progress towards a
  // target, so a non-zero target here made the demo look different from a
  // hand-entered account.
  const categories = [
    { id: "rent", name: CATEGORY_NAMES.rent, nameKey: "cat_rent", monthlyTarget: 0, createdAt: iso(-60) },
    { id: "taxes", name: CATEGORY_NAMES.taxes, nameKey: "cat_taxes", monthlyTarget: 0, createdAt: iso(-60) },
    { id: "groceries", name: CATEGORY_NAMES.groceries, nameKey: "cat_groceries", monthlyTarget: 0, createdAt: iso(-60) },
    { id: "software", name: CATEGORY_NAMES.software, nameKey: "cat_software", monthlyTarget: 0, createdAt: iso(-60) },
  ];

  // Expenses are recorded the same way the app records them: a single
  // "allocate" entry per expense. The old seed also emitted separate "spend"
  // entries — a leftover from when money was first set aside and then paid out
  // — which double-counted every cost under the current model.
  const tx: Transaction[] = [];

  tx.push(mkInitial(-58, 2400));

  // Two months ago: a decent payment, then the month's costs.
  tx.push(mkIncome(-55, 2200, "Acme A.Ş.", "Web sitesi projesi 1. ödeme"));
  tx.push(mkExpense(-54, "rent", 1400, "Kira ödendi"));
  tx.push(mkExpense(-53, "groceries", 300, "Market + ev ihtiyaçları"));
  tx.push(mkExpense(-52, "software", 80, "SaaS yenilemeleri"));

  // Last month: a dry spell, then two payments landing close together.
  tx.push(mkIncome(-33, 600, "Beta Ltd.", "Küçük danışmanlık ücreti"));
  tx.push(mkExpense(-32, "rent", 1400, "Kira ödendi"));
  tx.push(mkExpense(-30, "groceries", 260, "Market"));
  tx.push(mkIncome(-12, 3100, "Acme A.Ş.", "Web sitesi projesi son ödeme"));
  tx.push(mkIncome(-11, 750, "Gamma Stüdyo", "Logo + marka kiti"));

  // This month — the dashboard's cards and pie chart are scoped to the current
  // month, so the demo has to have activity here or it all reads as empty.
  tx.push(mkIncome(dayThisMonth(2), 3500, "Delta Yazılım", "Aylık bakım anlaşması"));
  tx.push(mkExpense(dayThisMonth(3), "rent", 1400, "Kira ödendi"));
  tx.push(mkExpense(dayThisMonth(4), "groceries", 320, "Market + ev ihtiyaçları"));
  tx.push(mkExpense(dayThisMonth(5), "software", 80, "SaaS yenilemeleri"));
  tx.push(mkExpense(dayThisMonth(6), "taxes", 900, "Geçici vergi"));

  return {
    categories,
    transactions: tx,
    bufferSettings: { targetMonths: 2, criticalThresholdPct: 25, lowThresholdPct: 60 },
    initialized: true,
  };
}

/** A date in the current month, never in the future — the app refuses
 * future-dated income and expenses, so the demo must not create any. Returns a
 * `yyyy-mm-dd` string. */
function dayThisMonth(day: number): string {
  const now = new Date();
  const clamped = Math.min(day, now.getDate());
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`;
}

function iso(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

function mkInitial(daysOffset: number, amount: number): Transaction {
  return {
    id: newId("tx"),
    type: "initial_balance",
    date: iso(daysOffset),
    createdAt: new Date().toISOString(),
    postings: [{ account: UNALLOCATED, amount }],
    labelKey: "tx_initial_balance",
  };
}

/** Accepts either a day offset (negative = days ago) or an explicit
 * `yyyy-mm-dd`, so entries can be placed relative to today or pinned inside the
 * current month. */
function toDate(when: number | string): string {
  return typeof when === "string" ? when : iso(when);
}

function mkIncome(daysOffset: number | string, amount: number, source: string, note: string): Transaction {
  return {
    id: newId("tx"),
    type: "income",
    date: toDate(daysOffset),
    createdAt: new Date().toISOString(),
    postings: [{ account: UNALLOCATED, amount }],
    labelKey: "tx_income",
    labelParams: { source },
    note,
    meta: { source },
  };
}

/** One expense, shaped exactly like the one the app's own expense form
 * produces: cash out of unallocated, the amount recorded against the
 * category. */
function mkExpense(
  daysOffset: number | string,
  categoryId: string,
  amount: number,
  note: string
): Transaction {
  return {
    id: newId("tx"),
    type: "allocate",
    date: toDate(daysOffset),
    createdAt: new Date().toISOString(),
    postings: [
      { account: UNALLOCATED, amount: -amount },
      { account: categoryId, amount },
    ],
    labelKey: "tx_allocate",
    labelParams: { category: CATEGORY_NAMES[categoryId] ?? categoryId },
    note,
    meta: { categoryId },
  };
}
