"use client";

import React from "react";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { formatCurrency, totalCashOnHand, categoryDisplayName, renderTransactionLabel } from "@/lib/ledger";
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
  allocate: "default",
  deallocate: "default",
  transfer: "warn",
  spend: "bad",
  pay_credit_card: "warn",
  adjustment: "default",
};

export default function LogPage() {
  const { state } = useStore();
  const { t } = useLanguage();
  const categories = state.categories;
  const sorted = state.transactions
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const total = totalCashOnHand(state.transactions, categories);

  function accountName(account: string) {
    if (account === "unallocated") return t("account_unallocated");
    if (account === "buffer") return t("account_buffer");
    if (account === "credit_card") return t("account_credit_card");
    const cat = categories.find((c) => c.id === account);
    return cat ? categoryDisplayName(cat, t) : account;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
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
        <div className="divide-y divide-app-border">
          {sorted.map((tx) => (
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
                {tx.postings.map((p, i) => (
                  <p key={i} className={`text-xs ${p.amount < 0 ? "text-app-danger" : "text-app-success"}`}>
                    {accountName(p.account)}: {p.amount >= 0 ? "+" : ""}
                    {formatCurrency(p.amount)}
                  </p>
                ))}
              </div>
            </div>
          ))}
          {sorted.length === 0 && <p className="text-sm text-app-text-muted py-2">{t("no_transactions_yet")}</p>}
        </div>
      </Card>
    </div>
  );
}
