"use client";

import React from "react";
import { formatCurrency } from "@/lib/ledger";

export function Money({ amount, className = "" }: { amount: number; className?: string }) {
  const negative = amount < 0;
  return (
    <span className={`${negative ? "text-app-danger" : ""} ${className}`}>
      {formatCurrency(amount)}
    </span>
  );
}

export function ProgressBar({
  pct,
  tone = "default",
}: {
  pct: number;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color =
    tone === "good"
      ? "bg-app-success"
      : tone === "warn"
      ? "bg-app-warning"
      : tone === "bad"
      ? "bg-app-danger"
      : "bg-app-accent";
  return (
    <div className="w-full h-2 rounded-full bg-glass-strong overflow-hidden">
      <div
        className={`relative h-full ${color} rounded-full overflow-hidden transition-[width] duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] bar-shimmer`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function Card({
  children,
  className = "",
  style,
  // Forwarded so the onboarding tour can anchor to a card without the card
  // knowing anything about the tour.
  "data-tour": dataTour,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  "data-tour"?: string;
}) {
  return (
    <div
      style={style}
      data-tour={dataTour}
      className={`animate-rise bg-glass backdrop-blur-xl border border-app-border rounded-3xl p-5 sm:p-6 transition-all duration-300 ease-out hover:-translate-y-[3px] hover:border-app-border-strong hover:bg-glass-hover ${className}`}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const styles =
    tone === "good"
      ? "bg-app-success-soft text-app-success"
      : tone === "warn"
      ? "bg-app-warning-soft text-app-warning"
      : tone === "bad"
      ? "bg-app-danger-soft text-app-danger"
      : "bg-glass-strong text-app-text-secondary";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11.5px] font-semibold ${styles}`}>
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all duration-200 ease-out disabled:opacity-40 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-app-accent text-white shadow-[0_4px_14px_rgba(99,102,241,0.3)] hover:brightness-110 hover:-translate-y-px"
      : variant === "secondary"
      ? "bg-app-surface border border-app-border text-app-text hover:border-app-border-strong hover:-translate-y-px"
      : variant === "danger"
      ? "bg-app-danger text-white hover:brightness-110"
      : variant === "outline"
      ? // Same accent as the primary button, but carried by the text and border
        // only — a secondary action that stays visually related to the main one.
        "border border-app-accent text-app-accent hover:bg-app-accent-soft hover:-translate-y-px"
      : "text-app-text-secondary hover:bg-glass-subtle hover:text-app-text";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-app-danger-soft border border-app-danger/25 text-app-danger text-sm px-3 py-2.5">
      {message}
    </div>
  );
}
