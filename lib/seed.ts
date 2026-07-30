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
  const categories = [
    { id: "rent", name: CATEGORY_NAMES.rent, nameKey: "cat_rent", monthlyTarget: 1400, createdAt: iso(-60) },
    { id: "taxes", name: CATEGORY_NAMES.taxes, nameKey: "cat_taxes", monthlyTarget: 900, createdAt: iso(-60) },
    { id: "groceries", name: CATEGORY_NAMES.groceries, nameKey: "cat_groceries", monthlyTarget: 450, createdAt: iso(-60) },
    { id: "software", name: CATEGORY_NAMES.software, nameKey: "cat_software", monthlyTarget: 80, createdAt: iso(-60) },
  ];

  const tx: Transaction[] = [];

  tx.push(mkInitial(-58, 2400));

  // Month -2: decent month, allocate to essentials
  tx.push(mkIncome(-55, 2200, "Acme A.Ş.", "Web sitesi projesi 1. ödeme"));
  tx.push(mkAllocate(-54, "rent", 1400));
  tx.push(mkAllocate(-54, "taxes", 500));
  tx.push(mkAllocate(-53, "groceries", 300));
  tx.push(mkSpend(-50, "rent", 1400, "Kira ödendi"));
  tx.push(mkSpend(-45, "groceries", 260, "Market + ev ihtiyaçları"));

  // Month -1: dry spell, then two payments land close together
  tx.push(mkIncome(-33, 600, "Beta Ltd.", "Küçük danışmanlık ücreti"));
  tx.push(mkAllocate(-33, "software", 80));
  tx.push(mkAllocate(-33, "groceries", 200));
  tx.push(mkSpend(-30, "software", 78, "SaaS yenilemeleri"));

  // Dry spell — nothing for ~18 days
  tx.push(mkIncome(-12, 3100, "Acme A.Ş.", "Web sitesi projesi son ödeme"));
  tx.push(mkIncome(-11, 750, "Gamma Stüdyo", "Logo + marka kiti"));
  tx.push(mkAllocate(-10, "rent", 1400));
  tx.push(mkAllocate(-10, "taxes", 900));
  tx.push(mkAllocate(-9, "groceries", 150));
  tx.push(mkSpend(-8, "rent", 1400, "Kira ödendi"));
  tx.push(mkSpend(-3, "groceries", 210, "Market + ev ihtiyaçları"));

  return {
    categories,
    transactions: tx,
    bufferSettings: { targetMonths: 2, criticalThresholdPct: 25, lowThresholdPct: 60 },
    initialized: true,
  };
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

function mkIncome(daysOffset: number, amount: number, source: string, note: string): Transaction {
  return {
    id: newId("tx"),
    type: "income",
    date: iso(daysOffset),
    createdAt: new Date().toISOString(),
    postings: [{ account: UNALLOCATED, amount }],
    labelKey: "tx_income",
    labelParams: { source },
    note,
    meta: { source },
  };
}

function mkAllocate(daysOffset: number, categoryId: string, amount: number): Transaction {
  return {
    id: newId("tx"),
    type: "allocate",
    date: iso(daysOffset),
    createdAt: new Date().toISOString(),
    postings: [
      { account: UNALLOCATED, amount: -amount },
      { account: categoryId, amount },
    ],
    labelKey: "tx_allocate",
    labelParams: { category: CATEGORY_NAMES[categoryId] ?? categoryId },
    meta: { categoryId },
  };
}

function mkSpend(daysOffset: number, categoryId: string, amount: number, note: string): Transaction {
  return {
    id: newId("tx"),
    type: "spend",
    date: iso(daysOffset),
    createdAt: new Date().toISOString(),
    postings: [{ account: categoryId, amount: -amount }],
    labelKey: "tx_spend",
    labelParams: { category: CATEGORY_NAMES[categoryId] ?? categoryId },
    note,
    meta: { categoryId },
  };
}
