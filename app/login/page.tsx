"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Button, ErrorBanner } from "@/components/ui";
import { PasswordField } from "@/components/PasswordField";
import { AuthBackground } from "@/components/AuthBackground";

type Mode = "signin" | "signup" | "forgot";

export default function LoginPage() {
  const { t, lang, setLang } = useLanguage();
  const { refresh } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inputCls =
    "w-full rounded-xl border border-app-border bg-glass text-app-text px-3 py-2.5 pr-10 text-sm placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40 focus:border-app-accent/50 transition-colors";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === "signup" && !username.trim()) {
      setError(t("err_username_required"));
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError(t("err_password_mismatch"));
      return;
    }

    // Reset request: only the address is needed, and the reply is the same
    // whether or not that address has an account.
    if (mode === "forgot") {
      setBusy(true);
      try {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || body.error) setError(body.error ?? "Something went wrong.");
        else setNotice(t("forgot_password_sent"));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(mode === "signin" ? "/api/auth/login" : "/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "signin" ? { email, password } : { email, password, username: username.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.error) {
        setError(body.error ?? "Something went wrong.");
        return;
      }
      if (mode === "signup" && body.needsConfirmation) {
        setNotice(t("auth_check_email"));
        return;
      }
      // Re-read the session before navigating. AuthProvider sits in the root
      // layout and only checks once on mount, so a client-side push to "/"
      // would leave it holding the signed-out state it captured on this page —
      // the dashboard would render with no user and the store would never
      // load, until a manual refresh remounted everything.
      await refresh();
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-app-bg">
      <AuthBackground />
      <div className="absolute top-4 right-4 z-10 flex items-center rounded-xl border border-app-border bg-app-surface/80 backdrop-blur overflow-hidden text-xs font-semibold">
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

      {/* relative + shadow lifts the card clearly off the decorative backdrop. */}
      <div className="relative z-10 w-full max-w-sm xl:max-w-md 2xl:max-w-lg rounded-3xl border border-app-border bg-app-surface/80 backdrop-blur-2xl p-7 xl:p-9 2xl:p-10 shadow-2xl">
        {/* Type and spacing step up with the card, so the extra room on a large
            monitor becomes a bigger form rather than wider empty margins. */}
        <div className="flex items-center gap-2.5 mb-6 2xl:mb-7">
          <div className="w-9 h-9 2xl:w-11 2xl:h-11 rounded-xl bg-app-accent flex items-center justify-center shadow-[0_4px_16px_rgba(99,102,241,0.35)]">
            <Wallet size={16} className="text-white 2xl:hidden" />
            <Wallet size={20} className="text-white hidden 2xl:block" />
          </div>
          <p className="text-[15px] 2xl:text-base font-semibold tracking-tight text-app-text">{t("app_name")}</p>
        </div>

        <h1 className="text-lg xl:text-xl 2xl:text-2xl font-semibold text-app-text mb-1">
          {mode === "signin"
            ? t("auth_sign_in")
            : mode === "signup"
              ? t("auth_sign_up")
              : t("forgot_password_title")}
        </h1>
        <p className="text-sm 2xl:text-[15px] text-app-text-secondary mb-5 2xl:mb-6">
          {mode === "forgot" ? t("forgot_password_subtitle") : t("auth_subtitle")}
        </p>

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
          {mode === "signup" && (
            <label className="block mb-4">
              <span className="block text-sm font-medium text-app-text-secondary mb-1.5">{t("username")}</span>
              <input
                className="w-full rounded-xl border border-app-border bg-glass text-app-text px-3 py-2.5 text-sm placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-app-accent/40 focus:border-app-accent/50 transition-colors"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("username_placeholder")}
                autoComplete="username"
              />
            </label>
          )}
          {mode !== "forgot" && (
            <PasswordField
              label={mode === "signup" ? t("auth_create_password") : t("auth_password")}
              value={password}
              onChange={setPassword}
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className={mode === "signup" ? "block mb-4" : "block mb-5"}
            />
          )}
          {mode === "signup" && (
            <PasswordField
              label={t("auth_confirm_password")}
              value={confirmPassword}
              onChange={setConfirmPassword}
              required
              minLength={6}
              autoComplete="new-password"
              className="block mb-5"
            />
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy
              ? "…"
              : mode === "signin"
                ? t("auth_sign_in")
                : mode === "signup"
                  ? t("auth_sign_up")
                  : t("forgot_password_submit")}
          </Button>
          {mode === "signin" && (
            <button
              type="button"
              onClick={() => {
                setMode("forgot");
                setError(null);
                setNotice(null);
                setPassword("");
              }}
              className="block w-full mt-3 text-center text-xs text-app-text-muted hover:text-app-text transition-colors"
            >
              {t("auth_forgot_password")}
            </button>
          )}
        </form>

        <Button
          variant="outline"
          className="w-full mt-8"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : mode === "forgot" ? "signin" : "signup");
            setError(null);
            setNotice(null);
            setConfirmPassword("");
            setUsername("");
          }}
        >
          {mode === "signin" ? t("auth_toggle_to_signup") : t("auth_toggle_to_signin")}
        </Button>
      </div>
    </div>
  );
}
