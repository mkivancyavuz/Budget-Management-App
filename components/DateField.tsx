"use client";

// Date field with an in-app calendar instead of the browser's native one.
//
// The native picker can't be themed: `color-scheme` gets the popup roughly the
// right shade, but its typography, corners, accent colour and spacing are all
// the browser's, and it looked out of place against the rest of the app. This
// draws the calendar from the same tokens as every other surface.
//
// Values are `yyyy-mm-dd` strings, the same format the ledger stores, so this
// is a drop-in replacement for <input type="date">.
import React, { useEffect, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import {
  addMonths,
  buildMonthGrid,
  formatYmd,
  isDisabled,
  parseYmd,
  todayYmd,
} from "@/lib/calendar";

const fieldCls =
  "w-full flex items-center justify-between gap-2 rounded-xl border border-app-border bg-glass text-app-text px-3 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-app-accent/40 focus:border-app-accent/50 transition-colors";

export function DateField({
  value,
  onChange,
  max,
  min,
}: {
  value: string; // yyyy-mm-dd
  onChange: (value: string) => void;
  max?: string;
  min?: string;
}) {
  const { t, lang } = useLanguage();
  const locale = lang === "tr" ? "tr-TR" : "en-US";

  const [open, setOpen] = useState(false);

  const selected = parseYmd(value);
  const today = todayYmd();
  // The month on display, which the user can page through without changing the
  // selected date.
  const [view, setView] = useState(() => ({
    year: selected?.year ?? today.year,
    month: selected?.month ?? today.month,
  }));

  // Re-centre on the selected date whenever the calendar is reopened.
  useEffect(() => {
    if (!open) return;
    const s = parseYmd(value);
    setView({ year: s?.year ?? today.year, month: s?.month ?? today.month });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape closes it. There's deliberately no outside-click handler: the panel
  // is part of the form now, so clicking elsewhere in the form shouldn't
  // dismiss it, and picking a day closes it anyway.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const weeks = buildMonthGrid(view.year, view.month);

  const monthLabel = new Date(view.year, view.month - 1, 1, 12).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  // Weekday initials straight from Intl, so they follow the chosen language.
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    // 2026-01-05 is a Monday, so this walks Monday..Sunday.
    new Date(2026, 0, 5 + i, 12).toLocaleDateString(locale, { weekday: "short" }).slice(0, 2)
  );

  const buttonLabel = selected
    ? new Date(selected.year, selected.month - 1, selected.day, 12).toLocaleDateString(locale, {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : t("date");

  function pick(day: number) {
    const next = formatYmd({ year: view.year, month: view.month, day });
    if (isDisabled(next, min, max)) return;
    onChange(next);
    setOpen(false);
  }

  return (
    <div>
      <button type="button" className={fieldCls} onClick={() => setOpen((o) => !o)}>
        <span className={selected ? "text-app-text" : "text-app-text-muted"}>{buttonLabel}</span>
        <Calendar size={15} className="shrink-0 text-app-text-muted" />
      </button>

      {/* Opens in the flow of the form rather than as a floating popover: the
          form lives in a modal with its own scroll container, so an absolutely
          positioned panel hung off the field either overflowed the modal or had
          to be scrolled to. Inline, it simply occupies the space below the
          field and the modal grows to fit. */}
      {open && (
        <div className="mt-2 w-full rounded-xl border border-app-border bg-glass-subtle p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <button
              type="button"
              aria-label="←"
              onClick={() => setView((v) => addMonths(v.year, v.month, -1))}
              className="p-1 rounded-lg text-app-text-secondary hover:text-app-text hover:bg-glass-subtle transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-[13px] font-semibold text-app-text capitalize">{monthLabel}</span>
            <button
              type="button"
              aria-label="→"
              onClick={() => setView((v) => addMonths(v.year, v.month, 1))}
              className="p-1 rounded-lg text-app-text-secondary hover:text-app-text hover:bg-glass-subtle transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-0.5">
            {weekdayLabels.map((label, i) => (
              <span key={i} className="text-center text-[10px] font-medium text-app-text-muted py-0.5">
                {label}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {weeks.flat().map((cell) => {
              if (cell.day === null) return <span key={cell.key} />;
              const iso = formatYmd({ year: view.year, month: view.month, day: cell.day });
              const disabled = isDisabled(iso, min, max);
              const isSelected = value === iso;
              const isToday = iso === formatYmd(today);

              return (
                <button
                  key={cell.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(cell.day as number)}
                  className={`h-7 rounded-md text-[13px] transition-colors ${
                    isSelected
                      ? "bg-app-accent text-white font-semibold"
                      : disabled
                        ? "text-app-text-muted/40 cursor-not-allowed"
                        : isToday
                          ? "text-app-accent font-semibold hover:bg-glass-subtle"
                          : "text-app-text hover:bg-glass-subtle"
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              const iso = formatYmd(today);
              if (!isDisabled(iso, min, max)) {
                onChange(iso);
                setOpen(false);
              }
            }}
            className="w-full mt-1.5 py-1.5 rounded-lg border border-app-border text-[11px] font-semibold text-app-text-secondary hover:text-app-text hover:border-app-border-strong transition-colors"
          >
            {t("date_today")}
          </button>
        </div>
      )}
    </div>
  );
}
