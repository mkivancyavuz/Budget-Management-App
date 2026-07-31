// Core domain types for the freelancer budget app.
// Design: every change to money is an immutable ledger transaction made of
// "postings" (double-entry style). Account balances are ALWAYS derived by
// summing postings — never stored as independent mutable fields. This keeps
// the numbers auditable and prevents drift bugs.

export type Account = string; // "unallocated" | "buffer" | "credit_card" | categoryId

export const UNALLOCATED: Account = "unallocated";
export const BUFFER: Account = "buffer";
export const CREDIT_CARD: Account = "credit_card";

export type TransactionType =
  | "initial_balance" // starting cash on hand when the user set up the app
  | "income" // real money received from a client -> unallocated
  | "allocate" // unallocated -> category
  | "deallocate" // category -> unallocated
  | "transfer" // category -> category (includes buffer contribute/draw)
  | "spend" // money leaves a category (paid out in real life)
  | "pay_credit_card" // real cash leaves unallocated to pay down the debt balance
  | "adjustment"; // manual correction (e.g. reconciling bank balance)

export interface Posting {
  account: Account; // "unallocated" | "buffer" | category id
  amount: number; // signed delta, in the account's currency units
}

export interface Transaction {
  id: string;
  type: TransactionType;
  date: string; // ISO date string (yyyy-mm-dd) — when the money event happened
  createdAt: string; // ISO timestamp — when it was logged
  postings: Posting[];
  labelKey: string; // i18n translation key, e.g. "tx_income" — rendered via translate()
  labelParams?: Record<string, string>; // params for the label (category names, sources, etc.)
  note?: string; // free-text note, entered by the user in whatever language they typed it
  meta?: {
    source?: string; // client/source name for income
    categoryId?: string; // primary category this event concerns
    fromCategoryId?: string;
    toCategoryId?: string;
    coveredFrom?: "unallocated" | "buffer"; // overspend was covered from here
    reason?: string; // e.g. buffer draw reason
  };
}

export interface Category {
  id: string;
  name: string;
  nameKey?: string; // i18n key for built-in/demo categories — lets the display name
  // follow the current language. Cleared as soon as the user edits the name by hand,
  // so custom categories keep exactly the text the user typed.
  monthlyTarget: number;
  isBuffer?: boolean;
  archived?: boolean;
  createdAt: string;
}

export interface BufferSettings {
  targetMonths: number; // e.g. 2 months of average expenses
  criticalThresholdPct: number; // e.g. 25 -> below 25% of target is "critical"
  lowThresholdPct: number; // e.g. 60 -> below 60% of target is "low"
}

export interface AppState {
  categories: Category[];
  transactions: Transaction[];
  bufferSettings: BufferSettings;
  initialized: boolean;
}
