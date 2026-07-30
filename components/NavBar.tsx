"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n";

export function NavBar() {
  const pathname = usePathname();
  const { t, lang, setLang } = useLanguage();

  const links = [
    { href: "/", label: t("nav_dashboard") },
    { href: "/history", label: t("nav_history") },
    { href: "/log", label: t("nav_log") },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="w-full max-w-5xl xl:max-w-6xl 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
        <span className="font-semibold text-slate-900">{t("app_name")}</span>
        <div className="flex items-center gap-2">
          <nav className="flex gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm px-3 py-1.5 rounded-lg ${
                  pathname === l.href ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
            <button
              onClick={() => setLang("tr")}
              className={`px-2.5 py-1.5 ${lang === "tr" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}
            >
              TR
            </button>
            <button
              onClick={() => setLang("en")}
              className={`px-2.5 py-1.5 ${lang === "en" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}
            >
              EN
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
