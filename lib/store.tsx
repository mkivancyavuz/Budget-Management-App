"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { AppState, Transaction, Category, UNALLOCATED, BUFFER } from "./types";
import { newId, unallocatedCash, accountBalance, round2, formatCurrency } from "./ledger";
import { buildSeedState } from "./seed";
import { useLanguage } from "./i18n";
import { useAuth } from "./auth";
import { createClient } from "./supabase/client";

// Persistence: every category/transaction/buffer-setting row lives in a
// shared Supabase/Postgres table, scoped to the signed-in user via a
// `user_id` column (the tenant discriminator) and enforced by Row Level
// Security (see supabase/schema.sql) — never localStorage, and never a
// per-tenant database. See lib/auth.tsx for the session/user context.

export type ActionResult = { ok: true } | { ok: false; error: string };

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
  spend: (input: {
    categoryId: string;
    amount: number;
    date: string;
    note?: string;
    coverShortfallFrom?: "unallocated" | "buffer" | null;
  }) => Promise<ActionResult>;
  bufferDraw: (input: { toCategoryId: string; amount: number; date: string; reason: string }) => Promise<ActionResult>;
  bufferContribute: (input: { amount: number; date: string; note?: string }) => Promise<ActionResult>;
  setInitialBalance: (amount: number, date: string) => Promise<ActionResult>;
  addCategory: (input: { name: string; monthlyTarget: number }) => Promise<ActionResult>;
  updateCategory: (id: string, patch: Partial<Pick<Category, "name" | "monthlyTarget" | "nameKey">>) => Promise<void>;
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

// --- Row <-> app-type mapping -------------------------------------------------

interface CategoryRow {
  id: string;
  name: string;
  name_key: string | null;
  monthly_target: number;
  is_buffer: boolean;
  archived: boolean;
  created_at: string;
}

interface TransactionRow {
  id: string;
  type: Transaction["type"];
  date: string;
  created_at: string;
  postings: Transaction["postings"];
  label_key: string;
  label_params: Transaction["labelParams"] | null;
  note: string | null;
  meta: Transaction["meta"] | null;
}

function categoryFromRow(r: CategoryRow): Category {
  return {
    id: r.id,
    name: r.name,
    nameKey: r.name_key ?? undefined,
    monthlyTarget: r.monthly_target,
    isBuffer: r.is_buffer,
    archived: r.archived,
    createdAt: r.created_at,
  };
}

function categoryToRow(c: Category, userId: string) {
  return {
    id: c.id,
    user_id: userId,
    name: c.name,
    name_key: c.nameKey ?? null,
    monthly_target: c.monthlyTarget,
    is_buffer: c.isBuffer ?? false,
    archived: c.archived ?? false,
    created_at: c.createdAt,
  };
}

function transactionFromRow(r: TransactionRow): Transaction {
  return {
    id: r.id,
    type: r.type,
    date: r.date,
    createdAt: r.created_at,
    postings: r.postings,
    labelKey: r.label_key,
    labelParams: r.label_params ?? undefined,
    note: r.note ?? undefined,
    meta: r.meta ?? undefined,
  };
}

function transactionToRow(tx: Transaction, userId: string) {
  return {
    id: tx.id,
    user_id: userId,
    type: tx.type,
    date: tx.date,
    created_at: tx.createdAt,
    postings: tx.postings,
    label_key: tx.labelKey,
    label_params: tx.labelParams ?? null,
    note: tx.note ?? null,
    meta: tx.meta ?? null,
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
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
      const [catsRes, txRes, bufRes] = await Promise.all([
        supabase.from("categories").select("*").order("created_at", { ascending: true }),
        supabase.from("transactions").select("*").order("date", { ascending: true }),
        supabase.from("buffer_settings").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      const categories = (catsRes.data ?? []).map((r) => categoryFromRow(r as CategoryRow));
      const transactions = (txRes.data ?? []).map((r) => transactionFromRow(r as TransactionRow));
      const bufferSettings = bufRes.data
        ? {
            targetMonths: bufRes.data.target_months,
            criticalThresholdPct: bufRes.data.critical_threshold_pct,
            lowThresholdPct: bufRes.data.low_threshold_pct,
          }
        : DEFAULT_BUFFER_SETTINGS;
      setState({ categories, transactions, bufferSettings, initialized: true });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, supabase]);

  const addTransaction = useCallback(
    async (tx: Transaction): Promise<ActionResult> => {
      if (!user) return { ok: false, error: t("err_category_not_found") };
      const { error } = await supabase.from("transactions").insert(transactionToRow(tx, user.id));
      if (error) return { ok: false, error: error.message };
      setState((s) => ({ ...s, transactions: [...s.transactions, tx] }));
      return { ok: true };
    },
    [supabase, user, t]
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
      const free = unallocatedCash(state.transactions);
      if (round2(input.amount) > free) {
        return { ok: false, error: t("err_allocate_exceeds", { free: formatCurrency(free) }) };
      }
      return addTransaction({
        id: newId("tx"),
        type: "allocate",
        date: input.date,
        createdAt: new Date().toISOString(),
        postings: [
          { account: UNALLOCATED, amount: -round2(input.amount) },
          { account: input.categoryId, amount: round2(input.amount) },
        ],
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
    async (input: {
      categoryId: string;
      amount: number;
      date: string;
      note?: string;
      coverShortfallFrom?: "unallocated" | "buffer" | null;
    }): Promise<ActionResult> => {
      if (input.amount <= 0) return { ok: false, error: t("err_spend_amount") };
      const cat = findCategory(input.categoryId);
      if (!cat) return { ok: false, error: t("err_category_not_found") };
      const bal = accountBalance(state.transactions, input.categoryId);
      const amt = round2(input.amount);

      if (amt > bal) {
        const shortfall = round2(amt - bal);
        if (!input.coverShortfallFrom) {
          return {
            ok: false,
            error: t("err_spend_over", { category: cat.name, balance: formatCurrency(bal), shortfall: formatCurrency(shortfall) }),
          };
        }
        const coverAccount = input.coverShortfallFrom === "buffer" ? BUFFER : UNALLOCATED;
        const coverAvailable = accountBalance(state.transactions, coverAccount);
        if (shortfall > coverAvailable) {
          return {
            ok: false,
            error: t("err_cover_insufficient", {
              source: t(input.coverShortfallFrom === "buffer" ? "source_buffer" : "source_unallocated"),
              available: formatCurrency(coverAvailable),
              shortfall: formatCurrency(shortfall),
            }),
          };
        }
        const coverRes = await addTransaction({
          id: newId("tx"),
          type: "transfer",
          date: input.date,
          createdAt: new Date().toISOString(),
          postings: [
            { account: coverAccount, amount: -shortfall },
            { account: input.categoryId, amount: shortfall },
          ],
          labelKey: "tx_cover_shortfall",
          labelParams: {
            category: cat.name,
            source: t(input.coverShortfallFrom === "buffer" ? "source_buffer" : "source_unallocated"),
          },
          note: input.note,
          meta: { categoryId: input.categoryId, coveredFrom: input.coverShortfallFrom },
        });
        if (!coverRes.ok) return coverRes;
      }

      return addTransaction({
        id: newId("tx"),
        type: "spend",
        date: input.date,
        createdAt: new Date().toISOString(),
        postings: [{ account: input.categoryId, amount: -amt }],
        labelKey: "tx_spend",
        labelParams: { category: cat.name },
        note: input.note,
        meta: { categoryId: input.categoryId },
      });
    },
    [addTransaction, findCategory, state.transactions, t]
  );

  const addCategory = useCallback(
    async (input: { name: string; monthlyTarget: number }): Promise<ActionResult> => {
      if (!input.name.trim()) return { ok: false, error: t("err_category_name_required") };
      if (input.monthlyTarget < 0) return { ok: false, error: t("err_target_negative") };
      if (!user) return { ok: false, error: t("err_category_not_found") };
      const category: Category = {
        id: newId("cat").replace("cat_", ""),
        name: input.name.trim(),
        monthlyTarget: round2(input.monthlyTarget),
        createdAt: new Date().toISOString(),
      };
      const { error } = await supabase.from("categories").insert(categoryToRow(category, user.id));
      if (error) return { ok: false, error: error.message };
      setState((s) => ({ ...s, categories: [...s.categories, category] }));
      return { ok: true };
    },
    [supabase, user, t]
  );

  const updateCategory = useCallback(
    async (id: string, patch: Partial<Pick<Category, "name" | "monthlyTarget" | "nameKey">>) => {
      if (!user) return;
      const dbPatch: Record<string, unknown> = {};
      if ("name" in patch) dbPatch.name = patch.name;
      if ("monthlyTarget" in patch) dbPatch.monthly_target = patch.monthlyTarget;
      if ("nameKey" in patch) dbPatch.name_key = patch.nameKey ?? null;
      const { error } = await supabase.from("categories").update(dbPatch).eq("id", id).eq("user_id", user.id);
      if (error) return;
      setState((s) => ({
        ...s,
        categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }));
    },
    [supabase, user]
  );

  const archiveCategory = useCallback(
    async (id: string) => {
      if (!user) return;
      const { error } = await supabase
        .from("categories")
        .update({ archived: true })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) return;
      setState((s) => ({
        ...s,
        categories: s.categories.map((c) => (c.id === id ? { ...c, archived: true } : c)),
      }));
    },
    [supabase, user]
  );

  const setBufferSettings = useCallback(
    async (patch: Partial<AppState["bufferSettings"]>) => {
      if (!user) return;
      const merged = { ...state.bufferSettings, ...patch };
      const { error } = await supabase.from("buffer_settings").upsert({
        user_id: user.id,
        target_months: merged.targetMonths,
        critical_threshold_pct: merged.criticalThresholdPct,
        low_threshold_pct: merged.lowThresholdPct,
      });
      if (error) return;
      setState((s) => ({ ...s, bufferSettings: merged }));
    },
    [supabase, user, state.bufferSettings]
  );

  const loadDemoData = useCallback(async () => {
    if (!user) return;
    const seed = buildSeedState();
    await supabase.from("transactions").delete().eq("user_id", user.id);
    await supabase.from("categories").delete().eq("user_id", user.id);
    const { error: catErr } = await supabase
      .from("categories")
      .insert(seed.categories.map((c) => categoryToRow(c, user.id)));
    const { error: txErr } = await supabase
      .from("transactions")
      .insert(seed.transactions.map((tx) => transactionToRow(tx, user.id)));
    if (catErr || txErr) return;
    setState(seed);
  }, [supabase, user]);

  const clearAll = useCallback(async () => {
    if (!user) return;
    await supabase.from("transactions").delete().eq("user_id", user.id);
    await supabase.from("categories").delete().eq("user_id", user.id);
    await supabase.from("buffer_settings").delete().eq("user_id", user.id);
    setState(emptyState());
  }, [supabase, user]);

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
      setInitialBalance,
      addCategory,
      updateCategory,
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
      setInitialBalance,
      addCategory,
      updateCategory,
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
