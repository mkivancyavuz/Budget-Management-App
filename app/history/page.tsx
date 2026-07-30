"use client";

import React from "react";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { computeIncomeInsights, formatCurrency } from "@/lib/ledger";
import { Card, Badge } from "@/components/ui";
import { IncomeTrendChart } from "@/components/IncomeTrendChart";
import { AnimatedCurrency } from "@/components/AnimatedNumber";

export default function HistoryPage() {
  const { state } = useStore();
  const { t } = useLanguage();
  const insights = computeIncomeInsights(state.transactions);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-app-text">{t("history_title")}</h1>
        <p className="text-sm text-app-text-secondary mt-1">{t("history_subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <h3 className="text-sm font-medium text-app-text-secondary">{t("avg_monthly_income")}</h3>
          <p className="text-2xl font-bold tracking-tight text-app-text mt-1">
            <AnimatedCurrency value={insights.average} />
          </p>
          <p className="text-xs text-app-text-muted mt-1">{t("months_of_history", { count: insights.months.length })}</p>
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-app-text-secondary">{t("best_month")}</h3>
          {insights.best ? (
            <>
              <p className="text-2xl font-bold tracking-tight text-app-success mt-1">
                <AnimatedCurrency value={insights.best.total} />
              </p>
              <p className="text-xs text-app-text-muted mt-1">{insights.best.month}</p>
            </>
          ) : (
            <p className="text-sm text-app-text-muted mt-1">{t("no_data_yet")}</p>
          )}
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-app-text-secondary">{t("worst_month")}</h3>
          {insights.worst ? (
            <>
              <p className="text-2xl font-bold tracking-tight text-app-danger mt-1">
                <AnimatedCurrency value={insights.worst.total} />
              </p>
              <p className="text-xs text-app-text-muted mt-1">{insights.worst.month}</p>
            </>
          ) : (
            <p className="text-sm text-app-text-muted mt-1">{t("no_data_yet")}</p>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="text-sm font-medium text-app-text-secondary mb-4">{t("monthly_trend")}</h3>
        <IncomeTrendChart months={insights.months} />
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-app-text-secondary mb-4">{t("monthly_totals")}</h3>
        <div className="divide-y divide-app-border">
          {insights.months
            .slice()
            .reverse()
            .map((m) => {
              const isBest = insights.best?.month === m.month;
              const isWorst = insights.worst?.month === m.month;
              return (
                <div key={m.month} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-app-text-secondary">{m.month}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-app-text-muted text-xs">{t("payments_count", { count: m.count })}</span>
                    <span className="font-medium text-app-text">{formatCurrency(m.total)}</span>
                    {isBest && <Badge tone="good">{t("best_badge")}</Badge>}
                    {isWorst && <Badge tone="bad">{t("worst_badge")}</Badge>}
                  </div>
                </div>
              );
            })}
          {insights.months.length === 0 && <p className="text-sm text-app-text-muted py-2">{t("no_income_yet")}</p>}
        </div>
      </Card>
    </div>
  );
}
