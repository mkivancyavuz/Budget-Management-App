"use client";

import { usePathname } from "next/navigation";
import { isStandaloneRoute } from "@/lib/routes";

export function Footer() {
  const pathname = usePathname();

  // Sign-in and password-recovery pages are full-screen cards — no app chrome.
  if (isStandaloneRoute(pathname)) return null;

  return (
    <footer className="w-full max-w-[1800px] mx-auto px-1 sm:px-2 py-6 text-center">
      <p className="text-xs text-app-text-muted">© 2026 Designed By Mehmet Kıvanç Yavuz</p>
    </footer>
  );
}
