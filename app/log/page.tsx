"use client";

import React from "react";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import {
  formatCurrency,
  totalCashOnHand,
  categoryDisplayName,
  renderTransactionLabel,
  expenseSignedAmount,
} from "@/lib/ledger";
import { Card, Badge } from "@/components/ui";
import { AnimatedCurrency } from "@/components/AnimatedNumber";

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
  const categories = state.categories;
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
