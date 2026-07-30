"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { Button, ErrorBanner } from "@/components/ui";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const { t, lang, setLang } = useLanguage();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inputCls =
    "w-full rounded-xl border border-app-border bg-glass text-app-text px-3 py-2.5 text-sm placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40 focus:border-app-accent/50 transition-colors";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const supabase = createClient();
    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(signInError.message);
          return;
        }
        router.push("/");
        router.refresh();
      } else {
        const { error: signUpError, data } = await supabase.auth.signUp({ email, password });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          setNotice(t("auth_check_email"));
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-app-bg">
      <div className="absolute top-4 right-4 flex items-center rounded-xl border border-app-border overflow-hidden text-xs font-semibold">
        <button
          onClick={() => setLang("tr")}
          className={`px-3 py-2 transition-colors ${lang === "tr" ? "bg-app-accent text-white" : "text-app-text-secondary"}`}
        >
          TR
        </button>
        <button
          onClick={() => setLang("en")}
          className={`px-3 py-2 transition-colors ${lang === "en" ? "bg-app-accent text-white" : "text-app-text-secondary"}`}
        >
          EN
        </button>
      </div>

      <div className="w-full max-w-sm rounded-3xl border border-app-border bg-glass backdrop-blur-xl p-7">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-xl bg-app-accent flex items-center justify-center shadow-[0_4px_16px_rgba(99,102,241,0.35)]">
            <Wallet size={16} className="text-white" />
          </div>
          <p className="text-[15px] font-semibold tracking-tight text-app-text">{t("app_name")}</p>
        </div>

        <h1 className="text-lg font-semibold text-app-text mb-1">
          {mode === "signin" ? t("auth_sign_in") : t("auth_sign_up")}
        </h1>
        <p className="text-sm text-app-text-secondary mb-5">{t("auth_subtitle")}</p>

        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} />
          </div>
        )}
        {notice && <p className="mb-4 text-sm text-app-success">{notice}</p>}

        <form onSubmit={handleSubmit}>
          <label className="block mb-4">
            <span className="block text-sm font-medium text-app-text-secondary mb-1.5">{t("auth_email")}</span>
            <input
              className={inputCls}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
          <label className="block mb-5">
            <span className="block text-sm font-medium text-app-text-secondary mb-1.5">{t("auth_password")}</span>
            <input
              className={inputCls}
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </label>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "…" : mode === "signin" ? t("auth_sign_in") : t("auth_sign_up")}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setNotice(null);
          }}
          className="mt-4 text-sm text-app-text-secondary hover:text-app-text transition-colors"
        >
          {mode === "signin" ? t("auth_toggle_to_signup") : t("auth_toggle_to_signin")}
        </button>
      </div>
    </div>
  );
}
