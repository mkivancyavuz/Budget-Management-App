"use client";

import React, { useState } from "react";
import { Pencil } from "lucide-react";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { accountBalance, formatCurrency, categoryDisplayName } from "@/lib/ledger";
import { Card, ProgressBar, Badge, Button, ErrorBanner } from "./ui";
import { Modal } from "./Modal";
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
  const { t } = useLanguage();
  const categories = state.categories.filter((c) => !c.archived && !c.isBuffer);
  const [editing, setEditing] = useState<Category | null>(null);

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
        <h3 className="text-sm font-medium text-app-text-secondary mb-4">{t("categories")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {categories.map((c) => {
            const bal = accountBalance(state.transactions, c.id);
            const target = c.monthlyTarget;
            const pct = target > 0 ? (bal / target) * 100 : bal > 0 ? 100 : 0;
            const overspent = bal < 0;
            const underfunded = target > 0 && bal < target * 0.5 && !overspent;
            const tone = overspent ? "bad" : underfunded ? "warn" : "good";

            return (
              <div key={c.id} className="rounded-xl border border-app-border p-4">
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-sm font-medium text-app-text truncate">{categoryDisplayName(c, t)}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {overspent && <Badge tone="bad">{t("overspent")}</Badge>}
                    {!overspent && underfunded && <Badge tone="warn">{t("underfunded")}</Badge>}
                    <button
                      onClick={() => setEditing(c)}
                      aria-label={t("edit")}
                      title={t("edit")}
                      className="text-app-text-muted hover:text-app-text transition-colors p-1 rounded-lg hover:bg-glass-subtle"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-lg font-semibold text-app-text mb-1">
                  {formatCurrency(bal)}
                  {target > 0 && <span className="text-sm font-normal text-app-text-muted"> / {formatCurrency(target)}</span>}
                </p>
                {target > 0 && <ProgressBar pct={pct} tone={tone} />}
              </div>
            );
          })}
          {categories.length === 0 && (
            <p className="text-sm text-app-text-muted col-span-full">{t("no_categories_yet")}</p>
          )}
        </div>
      </Card>

      {editing && (
        <EditCategoryModal
          category={editing}
          currentAmount={accountBalance(state.transactions, editing.id)}
          onClose={() => setEditing(null)}
          onSave={async (name, newAmount) => {
            await updateCategory(editing.id, { name, nameKey: undefined });
            await adjustCategoryBalance({
              categoryId: editing.id,
              newAmount,
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
  onClose,
  onSave,
}: {
  category: Category;
  currentAmount: number;
  onClose: () => void;
  onSave: (name: string, newAmount: number) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(categoryDisplayName(category, t));
  const [amount, setAmount] = useState(String(currentAmount));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(t("err_category_name_required"));
      return;
    }
    const parsed = parseFloat(amount);
    if (Number.isNaN(parsed) || parsed < 0) {
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
          <input
            className={inputCls}
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Button type="submit" className="w-full mt-1" disabled={saving}>
          {saving ? "…" : t("save_changes")}
        </Button>
      </form>
    </Modal>
  );
}
