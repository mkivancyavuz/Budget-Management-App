"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import {
  formatCurrency,
  totalCashOnHand,
  categoryDisplayName,
  renderTransactionLabel,
  expenseSignedAmount,
  currentMonthKey,
} from "@/lib/ledger";
import { Card, Badge, Button, ErrorBanner } from "@/components/ui";
import { AnimatedCurrency } from "@/components/AnimatedNumber";
import { MonthField } from "@/components/MonthField";
import { formatYmd, todayYmd, daysInMonth } from "@/lib/calendar";
import { Download, Loader2 } from "lucide-react";

const typeKey: Record<string, string> = {
  initial_balance: "type_initial_balance",
  income: "type_income",
  allocate: "type_allocate",
  deallocate: "type_deallocate",
  transfer: "type_transfer",
  spend: "type_spend",
  pay_credit_card: "type_pay_credit_card",
  adjustment: "type_adjustment",
};

const typeTone: Record<string, "default" | "good" | "warn" | "bad"> = {
  initial_balance: "default",
  income: "good",
  allocate: "bad",
  deallocate: "default",
  transfer: "warn",
  spend: "bad",
  pay_credit_card: "warn",
  adjustment: "default",
};

export default function LogPage() {
  const { state } = useStore();
  const { t, lang } = useLanguage();
  const { currency } = useCurrency();
  const categories = state.categories;

  // Export range is picked by whole month — "Ağustos 2026" rather than an
  // exact day — since a report almost always means "this month" or "last
  // month", and stepping through months is quicker than a day-level
  // calendar for that. Defaults to "this month" on both ends.
  const today = todayYmd();
  const todayStr = formatYmd(today);
  const thisMonthKey = currentMonthKey();
  const [exportFromMonth, setExportFromMonth] = useState(thisMonthKey);
  const [exportToMonth, setExportToMonth] = useState(thisMonthKey);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState("");

  // The actual yyyy-mm-dd range sent to the server: the 1st of the start
  // month through either the end month's last day, or today if the end
  // month is the current (still in-progress) one — a month that hasn't
  // finished yet can't report on days that haven't happened.
  const exportFrom = `${exportFromMonth}-01`;
  const exportTo =
    exportToMonth === thisMonthKey
      ? todayStr
      : (() => {
          const [y, m] = exportToMonth.split("-").map(Number);
          return formatYmd({ year: y, month: m, day: daysInMonth(y, m) });
        })();

  async function handleExport() {
    // The date fields already clamp against each other and against today via
    // min/max, but that only stops new invalid picks — it doesn't retroactively
    // fix a range left over from before the other field moved. Checking again
    // here is what actually keeps a bad request from ever reaching the server.
    if (exportFrom > exportTo) {
      setExportError(t("log_export_range_invalid"));
      return;
    }
    if (exportTo > todayStr) {
      setExportError(t("log_export_future_date"));
      return;
    }

    setExportError("");
    setExportLoading(true);
    try {
      const res = await fetch("/api/export/transactions-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: exportFrom, to: exportTo, lang, currency }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.error === "range_reversed") setExportError(t("log_export_range_invalid"));
        else if (body.error === "future_date") setExportError(t("log_export_future_date"));
        else setExportError(t("log_export_error"));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `islem-ozeti_${exportFrom}_${exportTo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(t("log_export_error"));
    } finally {
      setExportLoading(false);
    }
  }
  const sorted = state.transactions
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const total = totalCashOnHand(state.transactions, categories);

  // Group the (already newest-first) list into months, keeping that order so
  // the newest month heads the page.
  const months: { key: string; label: string; transactions: typeof sorted }[] = [];
  for (const tx of sorted) {
    const key = tx.date.slice(0, 7); // yyyy-mm
    const last = months[months.length - 1];
    if (last && last.key === key) {
      last.transactions.push(tx);
    } else {
      months.push({ key, label: monthLabel(key), transactions: [tx] });
    }
  }

  function monthLabel(key: string) {
    const [year, month] = key.split("-").map(Number);
    if (!year || !month) return key;
    // Day 1 at midday avoids any timezone rollover into the previous month.
    return new Date(year, month - 1, 1, 12).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", {
      month: "long",
      year: "numeric",
    });
  }

  function accountName(account: string) {
    if (account === "unallocated") return t("account_unallocated");
    if (account === "buffer") return t("account_buffer");
    if (account === "credit_card") return t("account_credit_card");
    const cat = categories.find((c) => c.id === account);
    return cat ? categoryDisplayName(cat, t) : account;
  }

  // Transactions that represent money actually leaving: shown as one signed
  // total rather than the underlying double-entry postings. Corrections made
  // from "Gider Dağılımı" are included, and can be positive when an amount was
  // lowered.
  function isExpense(type: string) {
    return type === "allocate" || type === "spend" || type === "adjustment";
  }

  // Money coming in only ever lands in one place, so naming the account
  // ("Ayrılmamış") adds nothing — just show the amount.
  function isInflow(type: string) {
    return type === "income" || type === "initial_balance";
  }

  // Which category the expense hit, for the single summary line.
  function expenseAccountName(tx: { meta?: { categoryId?: string } }) {
    const id = tx.meta?.categoryId;
    return id ? accountName(id) : t("type_spend");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div data-tour="log-header">
          <h1 className="text-xl font-semibold text-app-text">{t("log_title")}</h1>
          <p className="text-sm text-app-text-secondary mt-1">{t("log_subtitle")}</p>
        </div>
        <Card className="text-right px-4 py-2">
          <p className="text-xs text-app-text-muted">{t("total_cash_on_hand")}</p>
          <p className="text-lg font-bold tracking-tight text-app-text">
            <AnimatedCurrency value={total} />
          </p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-app-text mb-2">{t("log_export_title")}</h2>
            <div className="flex flex-wrap items-start gap-3">
              <div className="w-44">
                <label className="block text-xs text-app-text-muted mb-1">{t("log_export_from")}</label>
                <MonthField value={exportFromMonth} onChange={setExportFromMonth} max={exportToMonth} />
              </div>
              <div className="w-44">
                <label className="block text-xs text-app-text-muted mb-1">{t("log_export_to")}</label>
                <MonthField value={exportToMonth} onChange={setExportToMonth} min={exportFromMonth} max={thisMonthKey} />
              </div>
            </div>
          </div>
          <Button variant="secondary" onClick={handleExport} disabled={exportLoading} className="ml-auto">
            {exportLoading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                {t("log_export_generating")}
              </>
            ) : (
              <>
                <Download size={15} />
                {t("log_export_button")}
              </>
            )}
          </Button>
        </div>
        {exportError && (
          <div className="mt-3">
            <ErrorBanner message={exportError} />
          </div>
        )}
      </Card>

      {months.length === 0 && (
        <Card>
          <p className="text-sm text-app-text-muted">{t("no_transactions_yet")}</p>
        </Card>
      )}

      {months.map((month) => (
        <Card key={month.key}>
          <div className="flex items-center justify-between gap-2 mb-1 pb-3 border-b border-app-border">
            <h2 className="text-sm font-semibold text-app-text">{month.label}</h2>
            <Badge>{t("transaction_count", { count: month.transactions.length })}</Badge>
          </div>
          <div className="divide-y divide-app-border">
            {month.transactions.map((tx) => (
              <div key={tx.id} className="py-3 flex items-start justify-between gap-3 text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone={typeTone[tx.type]}>{t(typeKey[tx.type])}</Badge>
                    <span className="font-medium text-app-text">{renderTransactionLabel(tx, categories, t)}</span>
                  </div>
                  {tx.note && <p className="text-xs text-app-text-secondary mt-1">{tx.note}</p>}
                  <p className="text-xs text-app-text-muted mt-1">{tx.date}</p>
                </div>
                <div className="text-right shrink-0">
                  {isExpense(tx.type) ? (
                    // An expense is money going out, so show it as a single
                    // signed figure. Listing the raw postings here showed the
                    // cash side as -X and the category side as +X, which read as
                    // if the expense had added money somewhere.
                    (() => {
                      const signed = expenseSignedAmount(tx);
                      return (
                        <p className={`text-xs ${signed < 0 ? "text-app-danger" : "text-app-success"}`}>
                          {expenseAccountName(tx)}: {signed >= 0 ? "+" : ""}
                          {formatCurrency(signed)}
                        </p>
                      );
                    })()
                  ) : isInflow(tx.type) ? (
                    <p className="text-xs text-app-success">
                      +{formatCurrency(tx.postings.reduce((sum, p) => sum + p.amount, 0))}
                    </p>
                  ) : (
                    tx.postings.map((p, i) => (
                      <p key={i} className={`text-xs ${p.amount < 0 ? "text-app-danger" : "text-app-success"}`}>
                        {accountName(p.account)}: {p.amount >= 0 ? "+" : ""}
                        {formatCurrency(p.amount)}
                      </p>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
