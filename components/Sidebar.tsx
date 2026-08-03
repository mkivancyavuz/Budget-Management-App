"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, History, ListTree, Sun, Moon } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { Avatar } from "./Avatar";

export function Sidebar() {
  const pathname = usePathname();
  const { t, lang, setLang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

  if (pathname?.startsWith("/login")) return null;

  const links = [
    { href: "/", label: t("nav_dashboard"), icon: LayoutGrid },
    { href: "/history", label: t("nav_history"), icon: History },
    { href: "/log", label: t("nav_log"), icon: ListTree },
  ];

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col h-[calc(100vh-24px)] sticky top-3 rounded-3xl border border-app-border bg-glass backdrop-blur-xl p-4">
      <Link
        href="/profile"
        className="group flex items-center gap-3 px-2 pb-7 pt-1 rounded-xl transition-colors"
      >
        <Avatar
          user={user}
          size={44}
          textClassName="text-base"
          className="group-hover:brightness-110 transition-all"
        />
        <p className="text-[14px] font-semibold tracking-tight text-app-text group-hover:text-app-accent transition-colors">
          {t("profile_link")}
        </p>
      </Link>

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
    </aside>
  );
}
