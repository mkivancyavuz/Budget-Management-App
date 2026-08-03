"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, History, ListTree, Sun, Moon } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { Avatar } from "./Avatar";

export function MobileNav() {
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
    <div className="md:hidden sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-2 border-b border-app-border bg-app-bg/90 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2">
        {/* The profile link lives in the sidebar on desktop, but that's hidden
            on small screens — without this, /profile is unreachable on a
            phone. Mirrors the sidebar: avatar + "Profilim". */}
        <Link
          href="/profile"
          className={`group flex items-center gap-2 min-w-0 transition-colors ${
            pathname === "/profile" ? "text-app-accent" : "text-app-text"
          }`}
        >
          <Avatar user={user} size={36} textClassName="text-[13px]" />
          <span className="text-[15px] font-semibold truncate">{t("profile_link")}</span>
        </Link>
        {/* No sign-out here: it lives on the profile page, which the avatar
            beside this links to. Toggles are sized for thumbs rather than
            cursors. */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center rounded-xl border border-app-border overflow-hidden text-xs font-semibold">
            <button
              onClick={() => setTheme("dark")}
              aria-label="Dark mode"
              className={`px-3 py-2 flex items-center ${theme === "dark" ? "bg-app-accent text-white" : "text-app-text-secondary"}`}
            >
              <Moon size={16} />
            </button>
            <button
              onClick={() => setTheme("light")}
              aria-label="Light mode"
              className={`px-3 py-2 flex items-center ${theme === "light" ? "bg-app-accent text-white" : "text-app-text-secondary"}`}
            >
              <Sun size={16} />
            </button>
          </div>
          <div className="flex items-center rounded-xl border border-app-border overflow-hidden text-xs font-semibold">
            <button
              onClick={() => setLang("tr")}
              className={`px-3 py-2 ${lang === "tr" ? "bg-app-accent text-white" : "text-app-text-secondary"}`}
            >
              TR
            </button>
            <button
              onClick={() => setLang("en")}
              className={`px-3 py-2 ${lang === "en" ? "bg-app-accent text-white" : "text-app-text-secondary"}`}
            >
              EN
            </button>
          </div>
        </div>
      </div>
      <nav className="flex gap-1.5 mt-3 overflow-x-auto">
        {links.map((l) => {
          const Icon = l.icon;
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[13.5px] font-medium whitespace-nowrap transition-colors ${
                active ? "bg-app-accent-soft text-app-text" : "text-app-text-secondary"
              }`}
            >
              <Icon size={17} className={active ? "text-app-accent" : ""} />
              {l.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
