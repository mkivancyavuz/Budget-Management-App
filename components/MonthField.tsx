"use client";

// A month-only picker: no day grid, just the month name (and year) with
// arrows to step backwards/forwards. Built for the PDF export range on
// /log, where picking whole months reads more naturally than exact days —
// DateField (components/DateField.tsx) is still what every other date field
// in the app uses.
//
// Values are `yyyy-mm` strings, matching lib/ledger.ts's currentMonthKey().
import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { addMonths } from "@/lib/calendar";

function parseMonthKey(key: string): { year: number; month: number } {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

function formatMonthKey(year: number, month: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

export function MonthField({
  value,
  onChange,
  min,
  max,
}: {
  value: string; // yyyy-mm
  onChange: (value: string) => void;
  min?: string; // yyyy-mm
  max?: string; // yyyy-mm
}) {
  const { lang } = useLanguage();
  const locale = lang === "tr" ? "tr-TR" : "en-US";

  const { year, month } = parseMonthKey(value);
  const label = new Date(year, month - 1, 1, 12).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  const prev = addMonths(year, month, -1);
  const next = addMonths(year, month, 1);
  const prevKey = formatMonthKey(prev.year, prev.month);
  const nextKey = formatMonthKey(next.year, next.month);
  const canGoPrev = !min || prevKey >= min;
  const canGoNext = !max || nextKey <= max;

  return (
    <div className="w-full flex items-center justify-between gap-1 rounded-xl border border-app-border bg-glass text-app-text px-1.5 py-2 text-sm">
      <button
        type="button"
        aria-label="←"
        disabled={!canGoPrev}
        onClick={() => canGoPrev && onChange(prevKey)}
        className="p-1.5 rounded-lg text-app-text-secondary hover:text-app-text hover:bg-glass-subtle transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
      >
        <ChevronLeft size={15} />
      </button>
      <span className="flex-1 text-center text-sm font-medium capitalize truncate">{label}</span>
      <button
        type="button"
        aria-label="→"
        disabled={!canGoNext}
        onClick={() => canGoNext && onChange(nextKey)}
        className="p-1.5 rounded-lg text-app-text-secondary hover:text-app-text hover:bg-glass-subtle transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}
