"use client";

import React, { useState } from "react";
import { Pencil } from "lucide-react";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import {
  formatCurrency,
  categoryDisplayName,
  categoryExpenseTotals,
  currentMonthKey,
  normalizeCategoryName,
} from "@/lib/ledger";
import { Card, Badge, Button, ErrorBanner } from "./ui";
import { Modal } from "./Modal";
import { AmountInput } from "./AmountInput";
import type { Category } from "@/lib/types";

const inputCls =
  "w-full rounded-xl border border-app-border bg-glass text-app-text px-3 py-2.5 text-sm placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40 focus:border-app-accent/50 transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4 last:mb-0">
      <span className="block text-sm font-medium text-app-text-secondary mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export function CategoryGrid() {
  const { state, updateCategory, adjustCategoryBalance } = useStore();
  const { t, lang } = useLanguage();
  const categories = state.categories.filter((c) => !c.archived && !c.isBuffer);
  const [editing, setEditing] = useState<Category | null>(null);

  // Every figure here covers the current calendar month only, so the card
  // shows what has been spent per category *this* month rather than a
  // running all-time total.
  const thisMonth = currentMonthKey();
  const monthTotals = categoryExpenseTotals(state.transactions, thisMonth);
  const monthLabel = new Date().toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    // The edit modal is rendered as a sibling of <Card>, not nested inside
    // it — Card uses the `animate-rise` entrance animation, which (via
    // animation-fill-mode: both) leaves a permanent `transform` applied
    // after it finishes. That turns Card into a containing block for
    // position:fixed descendants, which trapped the modal behind later
    // cards on the page (e.g. "Gelir Trendi") instead of covering the
    // viewport like every other modal in the app.
    <>
      <Card>
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-sm font-medium text-app-text-secondary">{t("categories")}</h3>
          <Badge>{monthLabel}</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {/* Each tile is simply "what this category cost this month". The old
              "overspent"/"underfunded" badges and the progress bar compared the
              figure against a monthly target, which made sense when this card
              showed money *set aside* per category — now that it shows money
              *spent*, a category with little spend was being labelled
              "underfunded", which is backwards. Nothing in the app sets a
              target any more either, so the comparison had no input. */}
          {categories.map((c) => (
            <div key={c.id} className="rounded-xl border border-app-border p-4">
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="text-sm font-medium text-app-text truncate">{categoryDisplayName(c, t)}</span>
                <button
                  onClick={() => setEditing(c)}
                  aria-label={t("edit")}
                  title={t("edit")}
                  className="shrink-0 text-app-text-muted hover:text-app-text transition-colors p-1 rounded-lg hover:bg-glass-subtle"
                >
                  <Pencil size={14} />
                </button>
              </div>
              <p className="text-lg font-semibold text-app-text">{formatCurrency(monthTotals[c.id] ?? 0)}</p>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-app-text-muted col-span-full">{t("no_categories_yet")}</p>
          )}
        </div>
      </Card>

      {editing && (
        <EditCategoryModal
          category={editing}
          currentAmount={monthTotals[editing.id] ?? 0}
          // Renaming can collide just like adding can, so the modal needs the
          // other live categories' names to check against. Archived ones are
          // excluded — a deleted category shouldn't reserve its name.
          takenNames={state.categories
            .filter((c) => c.id !== editing.id && !c.archived)
            .map((c) => ({ id: c.id, label: categoryDisplayName(c, t), raw: c.name }))}
          onClose={() => setEditing(null)}
          onSave={async (name, newAmount) => {
            await updateCategory(editing.id, { name, nameKey: undefined });
            // The figure being edited is this month's spend, so correct by the
            // difference against the month total and date the correction today
            // — that keeps it inside the same month it adjusts.
            await adjustCategoryBalance({
              categoryId: editing.id,
              delta: newAmount - (monthTotals[editing.id] ?? 0),
              date: new Date().toISOString().slice(0, 10),
            });
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function EditCategoryModal({
  category,
  currentAmount,
  takenNames,
  onClose,
  onSave,
}: {
  category: Category;
  currentAmount: number;
  takenNames: { id: string; label: string; raw: string }[];
  onClose: () => void;
  onSave: (name: string, newAmount: number) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(categoryDisplayName(category, t));
  const [amount, setAmount] = useState<number>(currentAmount);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(t("err_category_name_required"));
      return;
    }
    const wanted = normalizeCategoryName(name);
    const clash = takenNames.find(
      (other) => normalizeCategoryName(other.label) === wanted || normalizeCategoryName(other.raw) === wanted
    );
    if (clash) {
      setError(t("err_category_exists", { name: clash.label }));
      return;
    }
    const parsed = amount;
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError(t("err_target_negative"));
      return;
    }
    setSaving(true);
    await onSave(name.trim(), parsed);
    setSaving(false);
  }

  return (
    <Modal title={t("edit_category")} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} />
          </div>
        )}
        <Field label={t("category_name")}>
          <input
            className={inputCls}
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("category_name_placeholder")}
          />
        </Field>
        <Field label={t("category_paid_amount")}>
          <AmountInput value={amount} onChange={setAmount} />
        </Field>
        <Button type="submit" className="w-full mt-1" disabled={saving}>
          {saving ? "…" : t("save_changes")}
        </Button>
      </form>
    </Modal>
  );
}
