"use client";

// The display currency (₺ / $ / €), chosen on the profile page.
//
// This is a *presentation* setting only: amounts are stored as plain numbers
// and nothing is ever converted between currencies. Switching from lira to
// dollars relabels 1.400 as $1.400 — it does not divide by an exchange rate.
// Doing real conversion would mean storing a currency per transaction plus
// historical rates, which is a much larger change.
//
// Kept in localStorage alongside the theme and language preferences rather than
// in the database, since it only affects how this browser renders figures.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type CurrencyCode, setActiveCurrency } from "./ledger";

const CURRENCY_KEY = "freelance-budget-currency";

export const CURRENCIES: { code: CurrencyCode; labelKey: string; symbol: string }[] = [
  { code: "TRY", labelKey: "currency_try", symbol: "₺" },
  { code: "USD", labelKey: "currency_usd", symbol: "$" },
  { code: "EUR", labelKey: "currency_eur", symbol: "€" },
];

function isCurrency(value: string | null): value is CurrencyCode {
  return value === "TRY" || value === "USD" || value === "EUR";
}

interface CurrencyShape {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
}

const CurrencyContext = createContext<CurrencyShape | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  // Starts on TRY so the server-rendered markup and the first client render
  // agree; the stored choice is applied in the effect below.
  const [currency, setCurrencyState] = useState<CurrencyCode>("TRY");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CURRENCY_KEY);
      if (isCurrency(stored)) {
        setCurrencyState(stored);
        setActiveCurrency(stored);
      }
    } catch {
      // Blocked storage — stay on the default.
    }
  }, []);

  const setCurrency = useCallback((c: CurrencyCode) => {
    // Push into the formatter before re-rendering, so every component that
    // calls formatCurrency() during this render picks up the new symbol.
    setActiveCurrency(c);
    setCurrencyState(c);
    try {
      window.localStorage.setItem(CURRENCY_KEY, c);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(() => ({ currency, setCurrency }), [currency, setCurrency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyShape {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within a CurrencyProvider");
  return ctx;
}
