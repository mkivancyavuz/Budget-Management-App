"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import {
  unallocatedCash,
  computeIncomeInsights,
  monthlyProfitTotals,
  creditCardDebt,
  categoryExpenseTotals,
  currentMonthKey,
  affectsCategorySpend,
  expenseSignedAmount,
  categoryDisplayName,
  formatCurrency,
  renderTransactionLabel,
} from "@/lib/ledger";
import { Card, Button, Badge } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { CategoryGrid } from "@/components/CategoryGrid";
import { IncomeTrendChart } from "@/components/IncomeTrendChart";
import { ProfitTrendChart } from "@/components/ProfitTrendChart";
import { CategoryPieChart } from "@/components/CategoryPieChart";
import { CategoryManager } from "@/components/CategoryManager";
import { AnimatedCurrency } from "@/components/AnimatedNumber";
import {
  IncomeForm,
  AllocateForm,
  InitialBalanceForm,
  PayCreditCardForm,
} from "@/components/ActionForms";

type ModalKind =
  | "income"
  | "allocate"
  | "manageCategories"
  | "initialBalance"
  | "payCreditCard"
  | null;

export default function DashboardPage() {
  const { state, loading, loadDemoData, clearAll } = useStore();
  const { t, lang } = useLanguage();
  const [modal, setModal] = useState<ModalKind>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  if (loading) {
    return <p className="text-sm text-app-text-secondary">{t("loading")}</p>;
  }

  const free = unallocatedCash(state.transactions);
  const insights = computeIncomeInsights(state.transactions);
  const profitMonths = monthlyProfitTotals(state.transactions);
  const debt = creditCardDebt(state.transactions);
  // The pie chart covers this calendar month only, so it answers "where is my
  // money going right now" rather than blending in older months.
  const thisMonth = currentMonthKey();
  const expenseTotals = categoryExpenseTotals(state.transactions, thisMonth);
  const pieData = state.categories
    .filter((c) => !c.archived)
    .map((c) => ({ categoryId: c.id, name: categoryDisplayName(c, t), amount: expenseTotals[c.id] ?? 0 }));
  const currentMonthLabel = new Date().toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", {
    month: "long",
    year: "numeric",
  });

  // These two lists are scoped to the current month as well, so the whole
  // top of the dashboard describes the same period.
  // Not truncated — the whole month is listed and the card scrolls, so nothing
  // is silently hidden once there are more than a handful of entries.
  const recentIncome = state.transactions
    .filter((tx) => tx.type === "income" && tx.date.startsWith(thisMonth))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Corrections made from "Gider Dağılımı" are included, so editing an amount
  // there is reflected in this list too rather than only in the totals.
  const recentExpenses = state.transactions
    .filter((tx) => affectsCategorySpend(tx) && tx.date.startsWith(thisMonth))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const hasAnyIncomeHistory = state.transactions.some((tx) => tx.type === "income" || tx.type === "initial_balance");
  const hasAnyData = state.transactions.length > 0;
  const staleIncome = insights.daysSinceLastIncome !== null && insights.daysSinceLastIncome >= 21;

  return (
    <div className="space-y-6">
      {!hasAnyIncomeHistory && (
        <Card className="border-app-border bg-glass">
          <p className="text-sm text-app-text-secondary mb-3">{t("get_started_msg")}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setModal("initialBalance")}>{t("set_starting_balance")}</Button>
            <Button variant="ghost" onClick={loadDemoData}>
              {t("load_demo_data")}
            </Button>
          </div>
        </Card>
      )}

      {staleIncome && (
        <Card className="border-app-warning/30 bg-app-warning/10">
          <p className="text-sm text-app-warning">
            <span className="font-semibold">{t("stale_income_title", { days: insights.daysSinceLastIncome ?? 0 })}</span>{" "}
            {t("stale_income_body")}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card className="sm:col-span-1">
          <h3 className="text-sm font-medium text-app-text-secondary">{t("unallocated_cash")}</h3>
          <p className="text-3xl font-bold tracking-tight text-app-text mt-1">
            <AnimatedCurrency value={free} />
          </p>
          <p className="text-xs text-app-text-muted mt-1">{t("unallocated_cash_hint")}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button onClick={() => setModal("income")}>{t("log_income")}</Button>
            <Button variant="secondary" onClick={() => setModal("allocate")}>
              {t("allocate")}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-medium text-app-text-secondary">{t("recent_income")}</h3>
            <Badge>{currentMonthLabel}</Badge>
          </div>
          {/* Caps at roughly five rows, then scrolls — pr-1 keeps the amounts
              from sitting under the scrollbar. */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {recentIncome.length === 0 && <p className="text-sm text-app-text-muted">{t("no_payments_yet")}</p>}
            {recentIncome.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-app-text">{tx.meta?.source ?? renderTransactionLabel(tx, state.categories, t)}</p>
                  <p className="text-xs text-app-text-muted">{tx.date}</p>
                </div>
                <span className="font-semibold text-app-success">
                  +{formatCurrency(tx.postings[0]?.amount ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-medium text-app-text-secondary">{t("recent_expenses")}</h3>
            <Badge>{currentMonthLabel}</Badge>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {recentExpenses.length === 0 && <p className="text-sm text-app-text-muted">{t("no_expenses_yet")}</p>}
            {recentExpenses.map((tx) => {
              // A correction can go either way: raising the spent amount takes
              // more money out (red), lowering it gives some back (green).
              const signed = expenseSignedAmount(tx);
              return (
                <div key={tx.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-app-text">{renderTransactionLabel(tx, state.categories, t)}</p>
                    <p className="text-xs text-app-text-muted">{tx.date}</p>
                  </div>
                  <span
                    className={`font-semibold shrink-0 ${signed < 0 ? "text-app-danger" : "text-app-success"}`}
                  >
                    {signed < 0 ? "-" : "+"}
                    {formatCurrency(Math.abs(signed))}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setModal("manageCategories")}>
          {t("manage_categories")}
        </Button>
        {hasAnyData && (
          <Button variant="danger" onClick={() => setConfirmClear(true)}>
            {t("clear_all_data")}
          </Button>
        )}
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-medium text-app-text-secondary">{t("credit_card_debt_title")}</h3>
            <p className={`text-2xl font-bold tracking-tight mt-1 ${debt > 0 ? "text-app-danger" : "text-app-text"}`}>
              {debt > 0 ? <AnimatedCurrency value={debt} /> : t("no_debt")}
            </p>
            <p className="text-xs text-app-text-muted mt-1">{t("credit_card_debt_hint")}</p>
          </div>
          <Button variant="secondary" onClick={() => setModal("payCreditCard")} disabled={debt <= 0}>
            {t("pay_credit_card")}
          </Button>
        </div>
      </Card>

      <CategoryGrid />

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-app-text-secondary">{t("category_pie_title")}</h3>
          <Badge>{currentMonthLabel}</Badge>
        </div>
        <CategoryPieChart data={pieData} />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-app-text-secondary">{t("profit_trend_title")}</h3>
        </div>
        <ProfitTrendChart months={profitMonths} />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-app-text-secondary">{t("income_trend_title")}</h3>
          {insights.average > 0 && <Badge>{t("avg_per_month", { amount: formatCurrency(insights.average) })}</Badge>}
        </div>
        <IncomeTrendChart months={insights.months} />
      </Card>

      {modal === "income" && (
        <Modal title={t("modal_income")} onClose={() => setModal(null)}>
          <IncomeForm onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal === "allocate" && (
        <Modal title={t("modal_allocate")} onClose={() => setModal(null)}>
          <AllocateForm onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal === "manageCategories" && (
        <Modal title={t("modal_manage_categories")} onClose={() => setModal(null)}>
          <CategoryManager />
        </Modal>
      )}
      {modal === "initialBalance" && (
        <Modal title={t("modal_initial_balance")} onClose={() => setModal(null)}>
          <InitialBalanceForm onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal === "payCreditCard" && (
        <Modal title={t("modal_pay_credit_card")} onClose={() => setModal(null)}>
          <PayCreditCardForm onDone={() => setModal(null)} />
        </Modal>
      )}

      {confirmClear && (
        <Modal title={t("clear_all_confirm_title")} onClose={() => setConfirmClear(false)}>
          <p className="text-sm text-app-text-secondary mb-5">{t("clear_all_confirm_body")}</p>
          <div className="flex flex-col gap-2">
            <Button
              variant="danger"
              disabled={clearing}
              onClick={async () => {
                setClearing(true);
                await clearAll();
                setClearing(false);
                setConfirmClear(false);
              }}
            >
              {clearing ? "…" : t("confirm_clear")}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmClear(false)} disabled={clearing}>
              {t("cancel")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
