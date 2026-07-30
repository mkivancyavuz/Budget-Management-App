"use client";

import React from "react";
import { useStore } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { accountBalance, bufferStatus, formatCurrency } from "@/lib/ledger";
import { BUFFER } from "@/lib/types";
import { Card, ProgressBar, Badge, Button } from "./ui";
import { AnimatedCurrency } from "./AnimatedNumber";

export function BufferHealthCard({
  onContribute,
  onDraw,
}: {
  onContribute: () => void;
  onDraw: () => void;
}) {
  const { state } = useStore();
  const { t } = useLanguage();
  const balance = accountBalance(state.transactions, BUFFER);

  // Target buffer = targetMonths * average monthly non-buffer category spend target,
  // falling back to sum of category monthly targets if no spend history yet.
  const monthlyExpenseTarget = state.categories
    .filter((c) => !c.isBuffer && !c.archived)
    .reduce((s, c) => s + c.monthlyTarget, 0);
  const target = monthlyExpenseTarget * state.bufferSettings.targetMonths;
  const pct = target > 0 ? (balance / target) * 100 : 0;
  const statusKey = bufferStatus(balance, target, state.bufferSettings.criticalThresholdPct, state.bufferSettings.lowThresholdPct);
  const statusLabel =
    statusKey === "Healthy"
      ? t("status_healthy")
      : statusKey === "Low"
      ? t("status_low")
      : statusKey === "Critical"
      ? t("status_critical")
      : t("status_no_target");

  const tone = statusKey === "Healthy" ? "good" : statusKey === "Low" ? "warn" : statusKey === "Critical" ? "bad" : "default";

  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium text-app-text-secondary">{t("buffer_fund")}</h3>
          <p className="text-2xl font-bold tracking-tight text-app-text mt-0.5">
            <AnimatedCurrency value={balance} />
          </p>
        </div>
        <Badge tone={tone as "good" | "warn" | "bad" | "default"}>{statusLabel}</Badge>
      </div>
      {target > 0 ? (
        <>
          <ProgressBar pct={pct} tone={tone as "good" | "warn" | "bad" | "default"} />
          <p className="text-xs text-app-text-secondary mt-2">
            {t("buffer_target_hint", {
              balance: formatCurrency(balance),
              target: formatCurrency(target),
              months: state.bufferSettings.targetMonths,
              plural: state.bufferSettings.targetMonths === 1 ? "" : "s",
              pct: pct.toFixed(0),
            })}
          </p>
        </>
      ) : (
        <p className="text-xs text-app-text-secondary">{t("buffer_no_target_hint")}</p>
      )}
      {statusKey === "Critical" && (
        <p className="text-xs text-app-danger mt-2 font-medium">{t("buffer_critical_msg")}</p>
      )}
      <div className="flex gap-2 mt-4">
        <Button variant="secondary" onClick={onContribute} className="flex-1">
          {t("contribute")}
        </Button>
        <Button variant="secondary" onClick={onDraw} className="flex-1">
          {t("draw")}
        </Button>
      </div>
    </Card>
  );
}
