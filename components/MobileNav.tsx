"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, History, ListTree, Wallet, Sun, Moon, LogOut } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";

export function MobileNav() {
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
    <div className="md:hidden sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-2 border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-app-accent flex items-center justify-center">
            <Wallet size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-app-text">{t("app_name")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-lg border border-app-border overflow-hidden text-[11px] font-semibold">
            <button
              onClick={() => setTheme("dark")}
              aria-label="Dark mode"
              className={`px-2 py-1 flex items-center ${theme === "dark" ? "bg-app-accent text-white" : "text-app-text-secondary"}`}
            >
              <Moon size={12} />
            </button>
            <button
              onClick={() => setTheme("light")}
              aria-label="Light mode"
              className={`px-2 py-1 flex items-center ${theme === "light" ? "bg-app-accent text-white" : "text-app-text-secondary"}`}
            >
              <Sun size={12} />
            </button>
          </div>
          <div className="flex items-center rounded-lg border border-app-border overflow-hidden text-[11px] font-semibold">
            <button
              onClick={() => setLang("tr")}
              className={`px-2 py-1 ${lang === "tr" ? "bg-app-accent text-white" : "text-app-text-secondary"}`}
            >
              TR
            </button>
            <button
              onClick={() => setLang("en")}
              className={`px-2 py-1 ${lang === "en" ? "bg-app-accent text-white" : "text-app-text-secondary"}`}
            >
              EN
            </button>
          </div>
          {user && (
            <button
              onClick={() => void signOut()}
              aria-label="Sign out"
              title={t("sign_out")}
              className="p-1.5 rounded-lg text-app-text-secondary hover:bg-glass-subtle hover:text-app-danger transition-colors"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
      <nav className="flex gap-1 mt-3 overflow-x-auto">
        {links.map((l) => {
          const Icon = l.icon;
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                active ? "bg-app-accent-soft text-app-text" : "text-app-text-secondary"
              }`}
            >
              <Icon size={14} className={active ? "text-app-accent" : ""} />
              {l.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
