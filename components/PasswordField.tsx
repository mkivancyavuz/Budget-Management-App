"use client";

// Single shared password input used everywhere a password is typed (login,
// sign-up, change password, delete account). Each instance owns its own
// reveal state, so showing one field never exposes another.
//
// Icon convention: the button shows the state you'd be switching TO is NOT
// what's drawn — instead it mirrors the field's current state. While the
// password is masked (the default) it shows the crossed-out eye; tapping it
// reveals the text and the icon becomes the plain open eye.
import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const inputCls =
  "w-full rounded-xl border border-app-border bg-glass text-app-text px-3 py-2.5 pr-10 text-sm placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40 focus:border-app-accent/50 transition-colors";

export function PasswordField({
  label,
  value,
  onChange,
  required,
  minLength,
  autoComplete = "current-password",
  className = "block mb-4",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  className?: string;
}) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  return (
    <label className={className}>
      <span className="block text-sm font-medium text-app-text-secondary mb-1.5">{label}</span>
      <div className="relative">
        <input
          className={inputCls}
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("hide_password") : t("show_password")}
          className="absolute right-0 top-0 h-full px-3 flex items-center text-app-text-muted hover:text-app-text transition-colors"
        >
          {visible ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
      </div>
    </label>
  );
}
