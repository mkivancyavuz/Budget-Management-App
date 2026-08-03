"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { AppState, Transaction, Category, UNALLOCATED, BUFFER, CREDIT_CARD } from "./types";
import {
  newId,
  unallocatedCash,
  accountBalance,
  round2,
  formatCurrency,
  normalizeCategoryName,
  categoryDisplayName,
} from "./ledger";
import { buildSeedState } from "./seed";
import { useLanguage } from "./i18n";
import { useAuth } from "./auth";
import { categoryFromRow, transactionFromRow } from "./rows";

// Persistence: every category/transaction/buffer-setting row lives in a
// shared Supabase/Postgres table, scoped to the signed-in user via a
// `user_id` column (the tenant discriminator) and enforced by Row Level
// Security (see supabase/schema.sql) — never localStorage, and never a
// per-tenant database. The browser never talks to Supabase directly though:
// every read/write goes through /api/data, which resolves the caller's
// identity from our own server-side `sessions` table (see
// lib/serverSession.ts) rather than trusting a client-held token. See
// lib/auth.tsx for the session/user context.

async function callApi(op: string, payload?: unknown): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op, payload }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.error) {
      return { ok: false, error: body.error ?? "Something went wrong." };
    }
    return { ok: true, data: body };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error." };
  }
}

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Today as `yyyy-mm-dd` in the user's own timezone — the latest date income or
 * an expense may be dated. Compared as strings, which is safe for this format. */
function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

interface StoreShape {
  state: AppState;
  loading: boolean;
  addTransaction: (tx: Transaction) => Promise<ActionResult>;
  logIncome: (input: { amount: number; source: string; date: string; note?: string }) => Promise<ActionResult>;
  allocate: (input: { categoryId: string; amount: number; date: string }) => Promise<ActionResult>;
  deallocate: (input: { categoryId: string; amount: number; date: string }) => Promise<ActionResult>;
  transferBetween: (input: {
    fromCategoryId: string;
    toCategoryId: string;
    amount: number;
    date: string;
    note?: string;
  }) => Promise<ActionResult>;
  spend: (input: { categoryId: string; amount: number; date: string; note?: string }) => Promise<ActionResult>;
  bufferDraw: (input: { toCategoryId: string; amount: number; date: string; reason: string }) => Promise<ActionResult>;
  bufferContribute: (input: { amount: number; date: string; note?: string }) => Promise<ActionResult>;
  payCreditCard: (input: { amount: number; date: string; note?: string }) => Promise<ActionResult>;
  setInitialBalance: (amount: number, date: string) => Promise<ActionResult>;
  addCategory: (input: { name: string; monthlyTarget: number }) => Promise<ActionResult>;
  updateCategory: (id: string, patch: Partial<Pick<Category, "name" | "monthlyTarget" | "nameKey">>) => Promise<void>;
  adjustCategoryBalance: (input: { categoryId: string; delta: number; date: string }) => Promise<ActionResult>;
  archiveCategory: (id: string) => Promise<void>;
  setBufferSettings: (patch: Partial<AppState["bufferSettings"]>) => Promise<void>;
  loadDemoData: () => Promise<void>;
  clearAll: () => Promise<void>;
}

const StoreContext = createContext<StoreShape | null>(null);

const DEFAULT_BUFFER_SETTINGS = { targetMonths: 2, criticalThresholdPct: 25, lowThresholdPct: 60 };

function emptyState(): AppState {
  return {
    categories: [],
    transactions: [],
    bufferSettings: DEFAULT_BUFFER_SETTINGS,
    initialized: true,
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [state, setState] = useState<AppState>({
    categories: [],
    transactions: [],
    bufferSettings: DEFAULT_BUFFER_SETTINGS,
    initialized: false,
  });
  const [loading, setLoading] = useState(true);

  // Load this tenant's data whenever the signed-in user changes.
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setState(emptyState());
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const res = await callApi("load");
      if (cancelled) return;
      if (!res.ok) {
        setState(emptyState());
        setLoading(false);
        return;
      }
      const categories = (res.data.categories ?? []).map(categoryFromRow);
      const transactions = (res.data.transactions ?? []).map(transactionFromRow);
      const bufferSettings = res.data.bufferSettings
        ? {
            targetMonths: res.data.bufferSettings.target_months,
            criticalThresholdPct: res.data.bufferSettings.critical_threshold_pct,
            lowThresholdPct: res.data.bufferSettings.low_threshold_pct,
          }
        : DEFAULT_BUFFER_SETTINGS;
      setState({ categories, transactions, bufferSettings, initialized: true });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const addTransaction = useCallback(
    async (tx: Transaction): Promise<ActionResult> => {
      if (!user) return { ok: false, error: t("err_category_not_found") };
      const res = await callApi("insertTransaction", { transaction: tx });
      if (!res.ok) return { ok: false, error: res.error };
      setState((s) => ({ ...s, transactions: [...s.transactions, tx] }));
      return { ok: true };
    },
    [user, t]
  );

  const findCategory = useCallback((id: string) => state.categories.find((c) => c.id === id), [state.categories]);

  const setInitialBalance = useCallback(
    async (amount: number, date: string): Promise<ActionResult> => {
      if (amount < 0) return { ok: false, error: t("err_initial_balance_negative") };
      return addTransaction({
        id: newId("tx"),
        type: "initial_balance",
        date,
        createdAt: new Date().toISOString(),
        postings: [{ account: UNALLOCATED, amount: round2(amount) }],
        labelKey: "tx_initial_balance",
      });
    },
    [addTransaction, t]
  );

  const logIncome = useCallback(
    async (input: { amount: number; source: string; date: string; note?: string }): Promise<ActionResult> => {
      if (input.amount <= 0) return { ok: false, error: t("err_income_amount") };
      if (!input.source.trim()) return { ok: false, error: t("err_income_source") };
      if (input.date > todayStr()) return { ok: false, error: t("err_future_date") };
      return addTransaction({
        id: newId("tx"),
        type: "income",
        date: input.date,
        createdAt: new Date().toISOString(),
        postings: [{ account: UNALLOCATED, amount: round2(input.amount) }],
        labelKey: "tx_income",
        labelParams: { source: input.source.trim() },
        note: input.note,
        meta: { source: input.source.trim() },
      });
    },
    [addTransaction, t]
  );

  const allocate = useCallback(
    async (input: { categoryId: string; amount: number; date: string }): Promise<ActionResult> => {
      if (input.amount <= 0) return { ok: false, error: t("err_amount_positive") };
      const cat = findCategory(input.categoryId);
      if (!cat) return { ok: false, error: t("err_category_not_found") };
      if (input.date > todayStr()) return { ok: false, error: t("err_future_date") };
      const amt = round2(input.amount);
      const free = unallocatedCash(state.transactions);
      // If there isn't enough cash on hand, cover as much as possible from
      // unallocated and silently push the rest to debt — no blocking error,
      // no manual choice. The category still receives the full amount, so
      // expense tracking always reflects what was actually spent.
      const available = round2(Math.max(0, Math.min(amt, free)));
      const shortfall = round2(amt - available);
      const postings = [
        { account: UNALLOCATED, amount: -available },
        { account: input.categoryId, amount: amt },
      ];
      if (shortfall > 0) postings.push({ account: CREDIT_CARD, amount: -shortfall });
      return addTransaction({
        id: newId("tx"),
        type: "allocate",
        date: input.date,
        createdAt: new Date().toISOString(),
        postings,
        labelKey: "tx_allocate",
        labelParams: { category: cat.name },
        meta: { categoryId: input.categoryId },
      });
    },
    [addTransaction, findCategory, state.transactions, t]
  );

  const deallocate = useCallback(
    async (input: { categoryId: string; amount: number; date: string }): Promise<ActionResult> => {
      if (input.amount <= 0) return { ok: false, error: t("err_amount_positive") };
      const cat = findCategory(input.categoryId);
      if (!cat) return { ok: false, error: t("err_category_not_found") };
      const bal = accountBalance(state.transactions, input.categoryId);
      if (round2(input.amount) > bal) {
        return { ok: false, error: t("err_deallocate_exceeds", { category: cat.name, balance: formatCurrency(bal) }) };
      }
      return addTransaction({
        id: newId("tx"),
        type: "deallocate",
        date: input.date,
        createdAt: new Date().toISOString(),
        postings: [
          { account: input.categoryId, amount: -round2(input.amount) },
          { account: UNALLOCATED, amount: round2(input.amount) },
        ],
        labelKey: "tx_deallocate",
        labelParams: { category: cat.name },
        meta: { categoryId: input.categoryId },
      });
    },
    [addTransaction, findCategory, state.transactions, t]
  );

  const transferBetween = useCallback(
    async (input: {
      fromCategoryId: string;
      toCategoryId: string;
      amount: number;
      date: string;
      note?: string;
    }): Promise<ActionResult> => {
      if (input.amount <= 0) return { ok: false, error: t("err_amount_positive") };
      if (input.fromCategoryId === input.toCategoryId) return { ok: false, error: t("err_transfer_same") };
      const from = findCategory(input.fromCategoryId);
      const to = findCategory(input.toCategoryId);
      if (!from || !to) return { ok: false, error: t("err_category_not_found") };
      const bal = accountBalance(state.transactions, input.fromCategoryId);
      if (round2(input.amount) > bal) {
        return { ok: false, error: t("err_transfer_exceeds", { category: from.name, balance: formatCurrency(bal) }) };
      }
      return addTransaction({
        id: newId("tx"),
        type: "transfer",
        date: input.date,
        createdAt: new Date().toISOString(),
        postings: [
          { account: input.fromCategoryId, amount: -round2(input.amount) },
          { account: input.toCategoryId, amount: round2(input.amount) },
        ],
        labelKey: "tx_transfer",
        labelParams: { from: from.name, to: to.name },
        note: input.note,
        meta: { fromCategoryId: input.fromCategoryId, toCategoryId: input.toCategoryId },
      });
    },
    [addTransaction, findCategory, state.transactions, t]
  );

  const bufferContribute = useCallback(
    async (input: { amount: number; date: string; note?: string }): Promise<ActionResult> => {
      return allocate({ categoryId: BUFFER, amount: input.amount, date: input.date });
    },
    [allocate]
  );

  const bufferDraw = useCallback(
    async (input: { toCategoryId: string; amount: number; date: string; reason: string }): Promise<ActionResult> => {
      if (input.amount <= 0) return { ok: false, error: t("err_amount_positive") };
      if (!input.reason.trim()) return { ok: false, error: t("err_buffer_reason") };
      const to = findCategory(input.toCategoryId);
      if (!to) return { ok: false, error: t("err_category_not_found") };
      const bufBal = accountBalance(state.transactions, BUFFER);
      if (round2(input.amount) > bufBal) {
        return { ok: false, error: t("err_buffer_exceeds", { balance: formatCurrency(bufBal) }) };
      }
      return addTransaction({
        id: newId("tx"),
        type: "transfer",
        date: input.date,
        createdAt: new Date().toISOString(),
        postings: [
          { account: BUFFER, amount: -round2(input.amount) },
          { account: input.toCategoryId, amount: round2(input.amount) },
        ],
        labelKey: "tx_buffer_draw",
        labelParams: { category: to.name },
        note: input.reason,
        meta: { fromCategoryId: BUFFER, toCategoryId: input.toCategoryId, reason: input.reason },
      });
    },
    [addTransaction, findCategory, state.transactions, t]
  );

  const spend = useCallback(
    async (input: { categoryId: string; amount: number; date: string; note?: string }): Promise<ActionResult> => {
      if (input.amount <= 0) return { ok: false, error: t("err_spend_amount") };
      const cat = findCategory(input.categoryId);
      if (!cat) return { ok: false, error: t("err_category_not_found") };
      const bal = accountBalance(state.transactions, input.categoryId);
      const amt = round2(input.amount);
      // Spend whatever the category actually has first; anything beyond that
      // is automatically pushed to debt — no prompt, no manual choice. The
      // category is only ever drawn down to zero from this single spend (it
      // never goes further negative than what this transaction itself covers
      // with debt), so "cash on hand" stays accurate.
      const available = round2(Math.max(0, Math.min(amt, bal)));
      const shortfall = round2(amt - available);
      const postings = [{ account: input.categoryId, amount: -available }];
      if (shortfall > 0) postings.push({ account: CREDIT_CARD, amount: -shortfall });

      return addTransaction({
        id: newId("tx"),
        type: "spend",
        date: input.date,
        createdAt: new Date().toISOString(),
        postings,
        labelKey: "tx_spend",
        labelParams: { category: cat.name },
        note: input.note,
        meta: { categoryId: input.categoryId },
      });
    },
    [addTransaction, findCategory, state.transactions, t]
  );

  const payCreditCard = useCallback(
    async (input: { amount: number; date: string; note?: string }): Promise<ActionResult> => {
      if (input.amount <= 0) return { ok: false, error: t("err_amount_positive") };
      const amt = round2(input.amount);
      const free = unallocatedCash(state.transactions);
      if (amt > free) {
        return { ok: false, error: t("err_pay_credit_card_insufficient_funds", { free: formatCurrency(free) }) };
      }
      const debt = -accountBalance(state.transactions, CREDIT_CARD);
      if (amt > round2(debt)) {
        return { ok: false, error: t("err_pay_exceeds_debt", { debt: formatCurrency(debt) }) };
      }
      return addTransaction({
        id: newId("tx"),
        type: "pay_credit_card",
        date: input.date,
        createdAt: new Date().toISOString(),
        postings: [
          { account: UNALLOCATED, amount: -amt },
          { account: CREDIT_CARD, amount: amt },
        ],
        labelKey: "tx_pay_credit_card",
        note: input.note,
      });
    },
    [addTransaction, state.transactions, t]
  );

  const addCategory = useCallback(
    async (input: { name: string; monthlyTarget: number }): Promise<ActionResult> => {
      if (!input.name.trim()) return { ok: false, error: t("err_category_name_required") };
      if (input.monthlyTarget < 0) return { ok: false, error: t("err_target_negative") };
      if (!user) return { ok: false, error: t("err_category_not_found") };
      // Reject a name that's already taken by a *live* category. Deleted
      // (archived) ones are skipped — they're gone as far as the user is
      // concerned, so their names must be free to use again. They keep their
      // own ids, so old transactions stay attributed to the right row.
      const wanted = normalizeCategoryName(input.name);
      const clash = state.categories.find(
        (c) =>
          !c.archived &&
          (normalizeCategoryName(c.name) === wanted ||
            normalizeCategoryName(categoryDisplayName(c, t)) === wanted)
      );
      if (clash) {
        return { ok: false, error: t("err_category_exists", { name: categoryDisplayName(clash, t) }) };
      }
      const category: Category = {
        id: newId("cat").replace("cat_", ""),
        name: input.name.trim(),
        monthlyTarget: round2(input.monthlyTarget),
        createdAt: new Date().toISOString(),
      };
      const res = await callApi("insertCategory", { category });
      if (!res.ok) {
        // The database's unique index caught a duplicate the local check
        // missed (e.g. another tab added the same name a moment ago).
        if (res.error === "duplicate_category") {
          return { ok: false, error: t("err_category_exists", { name: category.name }) };
        }
        return { ok: false, error: res.error };
      }
      setState((s) => ({ ...s, categories: [...s.categories, category] }));
      return { ok: true };
    },
    [user, t, state.categories]
  );

  const updateCategory = useCallback(
    async (id: string, patch: Partial<Pick<Category, "name" | "monthlyTarget" | "nameKey">>) => {
      if (!user) return;
      const res = await callApi("updateCategory", { id, patch });
      if (!res.ok) return;
      setState((s) => ({
        ...s,
        categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }));
    },
    [user]
  );

  const archiveCategory = useCallback(
    async (id: string) => {
      if (!user) return;

      // If nothing in the ledger touches this category, delete the row for
      // real — keeping an archived husk around made the app treat the name as
      // still taken. Categories that *do* have history are archived instead,
      // because their transactions still reference them and deleting the row
      // would leave those entries pointing at nothing.
      const hasHistory = state.transactions.some(
        (tx) => tx.meta?.categoryId === id || tx.postings.some((p) => p.account === id)
      );

      if (!hasHistory) {
        const res = await callApi("deleteCategory", { id });
        if (!res.ok) return;
        setState((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== id) }));
        return;
      }

      const res = await callApi("archiveCategory", { id });
      if (!res.ok) return;
      setState((s) => ({
        ...s,
        categories: s.categories.map((c) => (c.id === id ? { ...c, archived: true } : c)),
      }));
    },
    [user, state.transactions]
  );

  // Manual correction for a category's current balance ("Ödenen Tutar" in the
  // edit-category modal) — e.g. fixing a mis-typed spend amount. Recorded as
  // its own "adjustment" transaction (not a rewrite of past transactions) so
  // the ledger stays append-only; the delta between the current balance and
  // the number the user typed becomes the posting. Increasing the balance
  // pulls the difference from unallocated cash (falling back to debt if
  // there isn't enough, same as allocate()); decreasing it always just
  // returns the difference to unallocated cash.
  const adjustCategoryBalance = useCallback(
    async (input: { categoryId: string; delta: number; date: string }): Promise<ActionResult> => {
      const cat = findCategory(input.categoryId);
      if (!cat) return { ok: false, error: t("err_category_not_found") };
      // Takes a signed delta rather than a target figure: the caller decides
      // what the number on screen means (all-time spend, this month's spend,
      // …) and just says how much to move it by.
      const delta = round2(input.delta);
      if (delta === 0) return { ok: true };

      let postings;
      if (delta > 0) {
        const free = unallocatedCash(state.transactions);
        const available = round2(Math.max(0, Math.min(delta, free)));
        const shortfall = round2(delta - available);
        postings = [
          { account: UNALLOCATED, amount: -available },
          { account: input.categoryId, amount: delta },
        ];
        if (shortfall > 0) postings.push({ account: CREDIT_CARD, amount: -shortfall });
      } else {
        postings = [
          { account: input.categoryId, amount: delta },
          { account: UNALLOCATED, amount: -delta },
        ];
      }

      return addTransaction({
        id: newId("tx"),
        type: "adjustment",
        date: input.date,
        createdAt: new Date().toISOString(),
        postings,
        labelKey: "tx_adjustment",
        labelParams: { category: cat.name },
        meta: { categoryId: input.categoryId },
      });
    },
    [addTransaction, findCategory, state.transactions, t]
  );

  const setBufferSettings = useCallback(
    async (patch: Partial<AppState["bufferSettings"]>) => {
      if (!user) return;
      const merged = { ...state.bufferSettings, ...patch };
      const res = await callApi("upsertBufferSettings", merged);
      if (!res.ok) return;
      setState((s) => ({ ...s, bufferSettings: merged }));
    },
    [user, state.bufferSettings]
  );

  const loadDemoData = useCallback(async () => {
    if (!user) return;
    const seed = buildSeedState();
    const res = await callApi("loadDemoData", { categories: seed.categories, transactions: seed.transactions });
    if (!res.ok) return;
    setState(seed);
  }, [user]);

  const clearAll = useCallback(async () => {
    if (!user) return;
    const res = await callApi("clearAll");
    if (!res.ok) return;
    setState(emptyState());
  }, [user]);

  const value = useMemo<StoreShape>(
    () => ({
      state,
      loading,
      addTransaction,
      logIncome,
      allocate,
      deallocate,
      transferBetween,
      spend,
      bufferDraw,
      bufferContribute,
      payCreditCard,
      setInitialBalance,
      addCategory,
      updateCategory,
      adjustCategoryBalance,
      archiveCategory,
      setBufferSettings,
      loadDemoData,
      clearAll,
    }),
    [
      state,
      loading,
      addTransaction,
      logIncome,
      allocate,
      deallocate,
      transferBetween,
      spend,
      bufferDraw,
      bufferContribute,
      payCreditCard,
      setInitialBalance,
      addCategory,
      updateCategory,
      adjustCategoryBalance,
      archiveCategory,
      setBufferSettings,
      loadDemoData,
      clearAll,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreShape {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within a StoreProvider");
  return ctx;
}
