"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, History, ListTree, Wallet, Sparkles, Sun, Moon, LogOut } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";

export function Sidebar() {
  const pathname = usePathname();
  const { t, lang, setLang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();

  if (pathname?.startsWith("/login")) return null;

  const links = [
    { href: "/", label: t("nav_dashboard"), icon: LayoutGrid },
    { href: "/history", label: t("nav_history"), icon: History },
    { href: "/log", label: t("nav_log"), icon: ListTree },
  ];

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col h-[calc(100vh-24px)] sticky top-3 rounded-3xl border border-app-border bg-glass backdrop-blur-xl p-4">
      <div className="flex items-center gap-2.5 px-2 pb-7 pt-1">
        <div className="w-8 h-8 rounded-xl bg-app-accent flex items-center justify-center shadow-[0_4px_16px_rgba(99,102,241,0.35)]">
          <Wallet size={16} className="text-white" />
        </div>
        <div>
          <p className="text-[14px] font-semibold tracking-tight text-app-text">{t("app_name")}</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {links.map((l) => {
          const Icon = l.icon;
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-colors duration-200 ${
                active ? "bg-app-accent-soft text-app-text" : "text-app-text-secondary hover:bg-glass-hover hover:text-app-text"
              }`}
            >
              {active && <span className="absolute -left-4 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-app-accent" />}
              <Icon size={18} className={active ? "text-app-accent" : "opacity-80"} />
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="rounded-2xl p-4 mb-3 border border-app-accent/25 bg-gradient-to-br from-app-accent/15 to-app-accent/5">
        <Sparkles size={18} className="text-app-accent mb-2" />
        <p className="text-[13px] font-semibold text-app-text mb-1">{t("sidebar_tip_title")}</p>
        <p className="text-[11.5px] text-app-text-secondary leading-relaxed">{t("sidebar_tip_body")}</p>
      </div>

      <div className="flex items-center rounded-xl border border-app-border overflow-hidden text-xs font-semibold mb-2">
        <button
          onClick={() => setTheme("dark")}
          aria-label="Dark mode"
          className={`flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors ${
            theme === "dark" ? "bg-app-accent text-white" : "text-app-text-secondary hover:bg-glass-subtle"
          }`}
        >
          <Moon size={14} />
        </button>
        <button
          onClick={() => setTheme("light")}
          aria-label="Light mode"
          className={`flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors ${
            theme === "light" ? "bg-app-accent text-white" : "text-app-text-secondary hover:bg-glass-subtle"
          }`}
        >
          <Sun size={14} />
        </button>
      </div>

      <div className="flex items-center rounded-xl border border-app-border overflow-hidden text-xs font-semibold">
        <button
          onClick={() => setLang("tr")}
          className={`flex-1 py-2 transition-colors ${lang === "tr" ? "bg-app-accent text-white" : "text-app-text-secondary hover:bg-glass-subtle"}`}
        >
          TR
        </button>
        <button
          onClick={() => setLang("en")}
          className={`flex-1 py-2 transition-colors ${lang === "en" ? "bg-app-accent text-white" : "text-app-text-secondary hover:bg-glass-subtle"}`}
        >
          EN
        </button>
      </div>

      {user && (
        <div className="mt-2 flex items-center justify-between gap-2 px-1">
          <p className="text-[11px] text-app-text-muted truncate" title={user.email ?? undefined}>
            {user.email}
          </p>
          <button
            onClick={() => void signOut()}
            aria-label="Sign out"
            title={t("sign_out")}
            className="shrink-0 p-1.5 rounded-lg text-app-text-secondary hover:bg-glass-subtle hover:text-app-danger transition-colors"
          >
            <LogOut size={14} />
          </button>
        </div>
      )}
    </aside>
  );
}
