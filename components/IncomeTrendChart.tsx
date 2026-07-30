"use client";

import React from "react";
import { MonthlyIncome, formatCurrency } from "@/lib/ledger";
import { useLanguage } from "@/lib/i18n";

export function IncomeTrendChart({ months }: { months: MonthlyIncome[] }) {
  const { t } = useLanguage();
  if (months.length === 0) {
    return <p className="text-sm text-app-text-muted">{t("no_income_trend")}</p>;
  }
  const recent = months.slice(-6);
  const max = Math.max(...recent.map((m) => m.total), 1);
  const avg = recent.reduce((s, m) => s + m.total, 0) / recent.length;

  return (
    <div>
      <div className="flex items-end gap-3 h-36">
        {recent.map((m) => {
          const heightPct = Math.max(4, (m.total / max) * 100);
          const isLow = m.total < avg * 0.5;
          return (
            <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full">
              <span className="text-[10px] text-app-text-secondary mb-1">{formatCurrency(m.total)}</span>
              <div
                className={`w-full rounded-t-md ${isLow ? "bg-app-warning" : "bg-app-text-muted"}`}
                style={{ height: `${heightPct}%` }}
                title={`${m.month}: ${formatCurrency(m.total)}`}
              />
              <span className="text-[10px] text-app-text-muted mt-1">{m.month.slice(5)}</span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-app-text-secondary mt-3">{t("income_trend_note")}</p>
    </div>
  );
}
