"use client";

// Money input that groups thousands as you type: 12500 shows as "12.500", so
// long figures stay readable instead of running together.
//
// It has to be a text input, not <input type="number">: a number input rejects
// grouped values outright, so the browser would either clear the field or
// refuse the separators.
//
// Turkish convention throughout — "." groups thousands, "," is the decimal
// separator. The value handed to the parent is always a plain number, so
// nothing downstream has to know about the formatting.
import React, { useEffect, useState } from "react";

const inputCls =
  "w-full rounded-xl border border-app-border bg-glass text-app-text px-3 py-2.5 text-sm placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40 focus:border-app-accent/50 transition-colors";

const groupFormatter = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

/** Turns whatever was typed into `{ text, value }`: `text` is what to show in
 * the field, `value` the number it represents (NaN when empty). */
function normalize(raw: string): { text: string; value: number } {
  // Only digits and decimal separators survive. A typed "." is treated as
  // grouping and dropped — the field re-adds grouping itself.
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(/\./g, "");

  const firstComma = cleaned.indexOf(",");
  const intDigits = (firstComma === -1 ? cleaned : cleaned.slice(0, firstComma)).replace(/,/g, "");
  // At most two decimals, and any further commas are ignored.
  const decimals = firstComma === -1 ? "" : cleaned.slice(firstComma + 1).replace(/,/g, "").slice(0, 2);

  if (intDigits === "" && decimals === "") {
    return { text: firstComma === -1 ? "" : "0,", value: NaN };
  }

  const grouped = intDigits === "" ? "0" : groupFormatter.format(Number(intDigits));
  const text = firstComma === -1 ? grouped : `${grouped},${decimals}`;
  const value = Number(`${intDigits === "" ? "0" : intDigits}.${decimals === "" ? "0" : decimals}`);

  return { text, value };
}

export function AmountInput({
  value,
  onChange,
  required,
  placeholder = "0,00",
  className = "",
}: {
  /** Current numeric value, or NaN/undefined when the field is empty. */
  value: number;
  onChange: (value: number) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(() => (Number.isFinite(value) ? normalize(String(value).replace(".", ",")).text : ""));

  // Follow programmatic resets (e.g. a form clearing itself after submit)
  // without fighting the user's own typing.
  useEffect(() => {
    if (!Number.isFinite(value)) {
      setText((current) => (current === "" ? current : ""));
      return;
    }
    setText((current) => {
      const currentValue = normalize(current).value;
      if (Number.isFinite(currentValue) && Math.abs(currentValue - value) < 0.005) return current;
      return normalize(String(value).replace(".", ",")).text;
    });
  }, [value]);

  return (
    <input
      className={`${inputCls} ${className}`}
      type="text"
      // Brings up the numeric keypad on phones even though this is a text field.
      inputMode="decimal"
      autoComplete="off"
      required={required}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        const { text: nextText, value: nextValue } = normalize(e.target.value);
        setText(nextText);
        onChange(nextValue);
      }}
    />
  );
}
