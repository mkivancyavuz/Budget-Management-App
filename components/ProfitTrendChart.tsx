"use client";

import React from "react";
import { MonthlyProfit, formatCurrency, formatCurrencyCompact } from "@/lib/ledger";
import { useLanguage } from "@/lib/i18n";

export function ProfitTrendChart({ months }: { months: MonthlyProfit[] }) {
  const { t } = useLanguage();
  if (months.length === 0) {
    return <p className="text-sm text-app-text-muted">{t("no_profit_trend")}</p>;
  }
  const recent = months.slice(-6);
  const max = Math.max(...recent.map((m) => Math.abs(m.profit)), 1);

  return (
    <div>
      {/* min-w-0 on the columns lets them shrink below their label width;
          without it six labels force the row wider than the card on a phone. */}
      <div className="flex items-end gap-1.5 sm:gap-3 h-32 sm:h-36">
        {recent.map((m) => {
          const heightPct = Math.max(4, (Math.abs(m.profit) / max) * 100);
          const isPositive = m.profit >= 0;
          return (
            <div key={m.month} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full">
              {/* Compact amount on phones, full amount from sm up. */}
              <span className="sm:hidden text-[9px] leading-tight text-app-text-secondary mb-1 whitespace-nowrap">
                {formatCurrencyCompact(m.profit)}
              </span>
              <span className="hidden sm:block text-[10px] text-app-text-secondary mb-1 whitespace-nowrap">
                {formatCurrency(m.profit)}
              </span>
              <div
                className="w-full rounded-t-md"
                style={{ height: `${heightPct}%`, backgroundColor: isPositive ? "#22c55e" : "#ef4444" }}
                title={`${m.month}: ${formatCurrency(m.profit)}`}
              />
              <span className="text-[10px] text-app-text-muted mt-1">{m.month.slice(5)}</span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-app-text-secondary mt-3">{t("profit_trend_note")}</p>
    </div>
  );
}
