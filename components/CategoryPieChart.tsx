"use client";

// Donut chart of expenses by category. Built as plain SVG (stroke-dasharray
// trick) rather than a charting library, matching the rest of the app's
// bespoke, dependency-free charts (IncomeTrendChart, ProfitTrendChart).
import React from "react";
import { formatCurrency } from "@/lib/ledger";
import { useLanguage } from "@/lib/i18n";

export interface PieSlice {
  categoryId: string;
  name: string;
  amount: number;
}

const PALETTE = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#a855f7",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#14b8a6",
];

const SIZE = 300;
const CENTER = SIZE / 2;
const RADIUS = 110;
const STROKE = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CategoryPieChart({ data }: { data: PieSlice[] }) {
  const { t } = useLanguage();
  const slices = data.filter((d) => d.amount > 0).sort((a, b) => b.amount - a.amount);
  const total = slices.reduce((s, d) => s + d.amount, 0);

  if (slices.length === 0 || total <= 0) {
    return <p className="text-sm text-app-text-muted">{t("no_pie_data")}</p>;
  }

  let cumulative = 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-[240px] h-[240px] sm:w-[300px] sm:h-[300px] shrink-0">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full -rotate-90">
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="var(--glass-strong)" strokeWidth={STROKE} />
          {slices.map((s, i) => {
            const fraction = s.amount / total;
            const length = fraction * CIRCUMFERENCE;
            const offset = -cumulative;
            cumulative += length;
            return (
              <circle
                key={s.categoryId}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth={STROKE}
                strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xs text-app-text-muted">{t("total")}</p>
          <p className="text-xl font-bold text-app-text tracking-tight">{formatCurrency(total)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 max-w-md">
        {slices.map((s, i) => (
          <div key={s.categoryId} className="flex items-center gap-1.5 text-sm">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
            />
            <span className="text-app-text">{s.name}</span>
            <span className="font-semibold text-app-text">{Math.round((s.amount / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
