"use client";

import React from "react";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { accountBalance, formatCurrency, categoryDisplayName } from "@/lib/ledger";
import { Card, ProgressBar, Badge } from "./ui";

export function CategoryGrid() {
  const { state } = useStore();
  const { t } = useLanguage();
  const categories = state.categories.filter((c) => !c.archived && !c.isBuffer);

  return (
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
                <span className="text-sm font-medium text-app-text">{categoryDisplayName(c, t)}</span>
                {overspent && <Badge tone="bad">{t("overspent")}</Badge>}
                {!overspent && underfunded && <Badge tone="warn">{t("underfunded")}</Badge>}
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
  );
}
