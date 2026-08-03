"use client";

import React from "react";
import { MonthlyIncome, formatCurrency, formatCurrencyCompact } from "@/lib/ledger";
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
      {/* min-w-0 on the columns lets them shrink below their label width;
          without it six labels force the row wider than the card on a phone. */}
      <div className="flex items-end gap-1.5 sm:gap-3 h-32 sm:h-36">
        {recent.map((m) => {
          const heightPct = Math.max(4, (m.total / max) * 100);
          const isLow = m.total < avg * 0.5;
          return (
            <div key={m.month} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full">
              {/* Compact amount on phones, full amount from sm up. */}
              <span className="sm:hidden text-[9px] leading-tight text-app-text-secondary mb-1 whitespace-nowrap">
                {formatCurrencyCompact(m.total)}
              </span>
              <span className="hidden sm:block text-[10px] text-app-text-secondary mb-1 whitespace-nowrap">
                {formatCurrency(m.total)}
              </span>
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
    </div>
  );
}
