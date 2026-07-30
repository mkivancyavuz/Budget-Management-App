"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { BUFFER } from "@/lib/types";
import { accountBalance, unallocatedCash, formatCurrency, categoryDisplayName } from "@/lib/ledger";
import { Button, ErrorBanner } from "./ui";

const todayStr = () => new Date().toISOString().slice(0, 10);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-app-text-secondary mb-1.5">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-app-border bg-glass text-app-text px-3 py-2.5 text-sm placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40 focus:border-app-accent/50 transition-colors";

export function IncomeForm({ onDone }: { onDone: () => void }) {
  const { logIncome } = useStore();
  const { t } = useLanguage();
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await logIncome({ amount: parseFloat(amount), source, date, note });
        if (!res.ok) setError(res.error);
        else onDone();
      }}
    >
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}
      <Field label={t("amount_received")}>
        <input className={`${inputCls} no-spinner`} type="number" inputMode="decimal" step="0.01" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </Field>
      <Field label={t("client_or_source")}>
        <input className={inputCls} type="text" required value={source} onChange={(e) => setSource(e.target.value)} placeholder="örn. Acme A.Ş." />
      </Field>
      <Field label={t("date_received")}>
        <input className={inputCls} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label={t("note_optional")}>
        <input className={inputCls} type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("invoice_placeholder")} />
      </Field>
      <Button type="submit" className="w-full">{t("save_log_payment")}</Button>
    </form>
  );
}

export function AllocateForm({ onDone }: { onDone: () => void }) {
  const { state, allocate } = useStore();
  const { t } = useLanguage();
  const free = unallocatedCash(state.transactions);
  const categories = state.categories.filter((c) => !c.archived);
  const [categoryName, setCategoryName] = useState(categories[0] ? categoryDisplayName(categories[0], t) : "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [error, setError] = useState<string | null>(null);

  function resolveCategoryId(name: string): string | undefined {
    const match = categories.find((c) => categoryDisplayName(c, t).trim().toLowerCase() === name.trim().toLowerCase());
    return match?.id;
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const categoryId = resolveCategoryId(categoryName);
        if (!categoryId) {
          setError(t("err_category_not_found"));
          return;
        }
        const res = await allocate({ categoryId, amount: parseFloat(amount), date });
        if (!res.ok) setError(res.error);
        else onDone();
      }}
    >
      <p className="text-sm text-app-text-secondary mb-4">
        {t("unallocated_available", { amount: formatCurrency(free) })}
      </p>
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}
      <Field label={t("category")}>
        <input
          className={inputCls}
          type="text"
          list="allocate-categories"
          required
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          placeholder={t("category_name_placeholder")}
        />
        <datalist id="allocate-categories">
          {categories.map((c) => (
            <option key={c.id} value={categoryDisplayName(c, t)} />
          ))}
        </datalist>
      </Field>
      <Field label={t("amount_to_allocate")}>
        <input className={`${inputCls} no-spinner`} type="number" inputMode="decimal" step="0.01" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </Field>
      <Field label={t("date")}>
        <input className={inputCls} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Button type="submit" className="w-full">{t("allocate")}</Button>
    </form>
  );
}

export function TransferForm({ onDone }: { onDone: () => void }) {
  const { state, transferBetween } = useStore();
  const { t } = useLanguage();
  const categories = state.categories.filter((c) => !c.archived);
  const [fromId, setFromId] = useState(categories[0]?.id ?? "");
  const [toId, setToId] = useState(categories[1]?.id ?? categories[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fromBal = accountBalance(state.transactions, fromId);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await transferBetween({ fromCategoryId: fromId, toCategoryId: toId, amount: parseFloat(amount), date, note });
        if (!res.ok) setError(res.error);
        else onDone();
      }}
    >
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}
      <Field label={t("from_category")}>
        <select className={inputCls} value={fromId} onChange={(e) => setFromId(e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {categoryDisplayName(c, t)}
            </option>
          ))}
        </select>
      </Field>
      <p className="text-xs text-app-text-secondary -mt-3 mb-4">{t("available_amount", { amount: formatCurrency(fromBal) })}</p>
      <Field label={t("to_category")}>
        <select className={inputCls} value={toId} onChange={(e) => setToId(e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {categoryDisplayName(c, t)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("amount")}>
        <input className={inputCls} type="number" step="0.01" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </Field>
      <Field label={t("date")}>
        <input className={inputCls} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label={t("note_optional")}>
        <input className={inputCls} type="text" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button type="submit" className="w-full">{t("move_money")}</Button>
    </form>
  );
}

export function SpendForm({ onDone }: { onDone: () => void }) {
  const { state, spend } = useStore();
  const { t } = useLanguage();
  const categories = state.categories.filter((c) => !c.archived);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shortfallPrompt, setShortfallPrompt] = useState<{ shortfall: number } | null>(null);

  const bal = accountBalance(state.transactions, categoryId);
  const bufBal = accountBalance(state.transactions, BUFFER);
  const free = unallocatedCash(state.transactions);

  async function attempt(coverFrom?: "unallocated" | "buffer") {
    const res = await spend({ categoryId, amount: parseFloat(amount), date, note, coverShortfallFrom: coverFrom });
    if (!res.ok) {
      const amt = parseFloat(amount);
      if (!coverFrom && amt > bal) {
        setShortfallPrompt({ shortfall: parseFloat((amt - bal).toFixed(2)) });
        setError(null);
      } else {
        setError(res.error);
      }
    } else {
      onDone();
    }
  }

  if (shortfallPrompt) {
    return (
      <div>
        <ErrorBanner
          message={t("cover_shortfall_msg", {
            shortfall: formatCurrency(shortfallPrompt.shortfall),
            balance: formatCurrency(bal),
          })}
        />
        <div className="mt-4 flex flex-col gap-2">
          <Button
            variant="secondary"
            disabled={free < shortfallPrompt.shortfall}
            onClick={() => void attempt("unallocated")}
          >
            {t("cover_from_unallocated", { amount: formatCurrency(free) })}
          </Button>
          <Button
            variant="secondary"
            disabled={bufBal < shortfallPrompt.shortfall}
            onClick={() => void attempt("buffer")}
          >
            {t("cover_from_buffer", { amount: formatCurrency(bufBal) })}
          </Button>
          <Button variant="ghost" onClick={() => setShortfallPrompt(null)}>
            {t("cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await attempt(undefined);
      }}
    >
      <p className="text-sm text-app-text-secondary mb-4">{t("category_balance", { amount: formatCurrency(bal) })}</p>
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}
      <Field label={t("category")}>
        <select className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {categoryDisplayName(c, t)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("amount_spent")}>
        <input className={inputCls} type="number" step="0.01" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </Field>
      <Field label={t("date")}>
        <input className={inputCls} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label={t("note_optional")}>
        <input className={inputCls} type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("what_was_this_for")} />
      </Field>
      <Button type="submit" className="w-full">{t("log_spend_btn")}</Button>
    </form>
  );
}

export function BufferDrawForm({ onDone }: { onDone: () => void }) {
  const { state, bufferDraw } = useStore();
  const { t } = useLanguage();
  const categories = state.categories.filter((c) => !c.archived && !c.isBuffer);
  const [toName, setToName] = useState(categories[0]?.name ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bufBal = accountBalance(state.transactions, BUFFER);

  function resolveCategoryId(name: string): string | undefined {
    const match = categories.find((c) => categoryDisplayName(c, t).trim().toLowerCase() === name.trim().toLowerCase());
    return match?.id;
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const toId = resolveCategoryId(toName);
        if (!toId) {
          setError(t("err_category_not_found"));
          return;
        }
        const res = await bufferDraw({ toCategoryId: toId, amount: parseFloat(amount), date, reason });
        if (!res.ok) setError(res.error);
        else onDone();
      }}
    >
      <p className="text-sm text-app-text-secondary mb-4">{t("buffer_available", { amount: formatCurrency(bufBal) })}</p>
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}
      <Field label={t("cover_shortfall_in")}>
        <input
          className={inputCls}
          type="text"
          list="buffer-draw-categories"
          required
          value={toName}
          onChange={(e) => setToName(e.target.value)}
          placeholder={t("category_name_placeholder")}
        />
        <datalist id="buffer-draw-categories">
          {categories.map((c) => (
            <option key={c.id} value={categoryDisplayName(c, t)} />
          ))}
        </datalist>
      </Field>
      <Field label={t("amount_to_draw")}>
        <input className={inputCls} type="number" step="0.01" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </Field>
      <Field label={t("date")}>
        <input className={inputCls} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label={t("reason_required")}>
        <input className={inputCls} type="text" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reason_placeholder")} />
      </Field>
      <Button type="submit" className="w-full">{t("draw_from_buffer")}</Button>
    </form>
  );
}

export function BufferContributeForm({ onDone }: { onDone: () => void }) {
  const { state, bufferContribute } = useStore();
  const { t } = useLanguage();
  const free = unallocatedCash(state.transactions);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await bufferContribute({ amount: parseFloat(amount), date });
        if (!res.ok) setError(res.error);
        else onDone();
      }}
    >
      <p className="text-sm text-app-text-secondary mb-4">{t("unallocated_available", { amount: formatCurrency(free) })}</p>
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}
      <Field label={t("amount_to_contribute")}>
        <input className={inputCls} type="number" step="0.01" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </Field>
      <Field label={t("date")}>
        <input className={inputCls} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Button type="submit" className="w-full">{t("contribute_to_buffer")}</Button>
    </form>
  );
}

export function CategoryForm({ onDone }: { onDone: () => void }) {
  const { addCategory } = useStore();
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await addCategory({ name, monthlyTarget: 0 });
        if (!res.ok) setError(res.error);
        else onDone();
      }}
    >
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}
      <Field label={t("category_name")}>
        <input className={inputCls} type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder={t("category_name_placeholder")} />
      </Field>
      <Button type="submit" className="w-full">{t("add_category")}</Button>
    </form>
  );
}

export function InitialBalanceForm({ onDone }: { onDone: () => void }) {
  const { setInitialBalance } = useStore();
  const { t } = useLanguage();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await setInitialBalance(parseFloat(amount), date);
        if (!res.ok) setError(res.error);
        else onDone();
      }}
    >
      <p className="text-sm text-app-text-secondary mb-4">{t("initial_balance_hint")}</p>
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}
      <Field label={t("current_account_balance")}>
        <input className={inputCls} type="number" step="0.01" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </Field>
      <Field label={t("as_of_date")}>
        <input className={inputCls} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Button type="submit" className="w-full">{t("set_balance")}</Button>
    </form>
  );
}
