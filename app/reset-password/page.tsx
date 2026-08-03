"use client";

// Landing page for the recovery link in the reset email.
//
// Supabase appends the token to the URL *fragment* (#access_token=…), which is
// never sent to the server — so it has to be read here in the browser and
// posted to /api/auth/reset-password, which verifies it before changing the
// password. The fragment is wiped from the address bar immediately afterwards
// so the token doesn't linger in history.
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Button, ErrorBanner } from "@/components/ui";
import { PasswordField } from "@/components/PasswordField";
import { AuthBackground } from "@/components/AuthBackground";

export default function ResetPasswordPage() {
  const { t, lang, setLang } = useLanguage();
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(hash);
    const token = params.get("access_token");
    const errorDescription = params.get("error_description");

    if (errorDescription) {
      setLinkError(errorDescription);
    } else if (token) {
      setAccessToken(token);
      window.history.replaceState(null, "", window.location.pathname);
    } else {
      setLinkError(t("err_reset_link_invalid"));
    }
    // Runs once on mount; t is stable enough for this one-off read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError(t("err_password_short"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("err_password_mismatch"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.error) {
        setError(
          body.error === "invalid_link"
            ? t("err_reset_link_invalid")
            : body.error === "weak_password"
              ? t("err_password_short")
              : (body.error ?? "Something went wrong.")
        );
        return;
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-app-bg">
      <AuthBackground />
      <div className="absolute top-0 right-0 z-10 flex items-center rounded-bl-xl 2xl:rounded-bl-2xl border-b border-l border-app-border bg-app-surface/80 backdrop-blur overflow-hidden text-xs xl:text-sm 2xl:text-base font-semibold">
        <button
          onClick={() => setLang("tr")}
          className={`px-3 py-2 xl:px-4 xl:py-2.5 2xl:px-6 2xl:py-3 transition-colors ${lang === "tr" ? "bg-app-accent text-white" : "text-app-text-secondary"}`}
        >
          TR
        </button>
        <button
          onClick={() => setLang("en")}
          className={`px-3 py-2 xl:px-4 xl:py-2.5 2xl:px-6 2xl:py-3 transition-colors ${lang === "en" ? "bg-app-accent text-white" : "text-app-text-secondary"}`}
        >
          EN
        </button>
      </div>

      <div className="relative z-10 w-full max-w-sm xl:max-w-md 2xl:max-w-lg rounded-3xl border border-app-border bg-app-surface/80 backdrop-blur-2xl p-7 xl:p-9 2xl:p-10 shadow-2xl">
        <div className="flex items-center gap-2.5 mb-6 2xl:mb-7">
          <div className="w-9 h-9 2xl:w-11 2xl:h-11 rounded-xl bg-app-accent flex items-center justify-center shadow-[0_4px_16px_rgba(99,102,241,0.35)]">
            <Wallet size={16} className="text-white 2xl:hidden" />
            <Wallet size={20} className="text-white hidden 2xl:block" />
          </div>
          <p className="text-[15px] 2xl:text-base font-semibold tracking-tight text-app-text">{t("app_name")}</p>
        </div>

        <h1 className="text-lg xl:text-xl 2xl:text-2xl font-semibold text-app-text mb-1">{t("reset_password_title")}</h1>

        {done ? (
          <>
            <p className="text-sm text-app-success mt-3 mb-5">{t("reset_password_done")}</p>
            <Button className="w-full" onClick={() => router.push("/login")}>
              {t("auth_sign_in")}
            </Button>
          </>
        ) : linkError ? (
          <>
            <div className="mt-4 mb-5">
              <ErrorBanner message={linkError} />
            </div>
            <Button variant="outline" className="w-full" onClick={() => router.push("/login")}>
              {t("back_to_login")}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-app-text-secondary mb-5">{t("reset_password_subtitle")}</p>
            {error && (
              <div className="mb-4">
                <ErrorBanner message={error} />
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <PasswordField
                label={t("new_password")}
                value={password}
                onChange={setPassword}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <PasswordField
                label={t("confirm_password")}
                value={confirmPassword}
                onChange={setConfirmPassword}
                required
                minLength={6}
                autoComplete="new-password"
                className="block mb-5"
              />
              <Button type="submit" className="w-full" disabled={busy || !accessToken}>
                {busy ? "…" : t("reset_password_submit")}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
