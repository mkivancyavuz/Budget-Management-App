"use client";

// The same accent glow the auth screens use, behind the signed-in app.
//
// Fixed rather than absolute, so it stays put while a long dashboard scrolls
// instead of sliding away with the content. Skipped on the standalone auth
// pages, which render their own backdrop (glow + dot texture) — otherwise the
// two would stack and double the brightness.
import { usePathname } from "next/navigation";
import { isStandaloneRoute } from "@/lib/routes";
import { GlowLayer } from "./GlowLayer";

export function SiteBackground() {
  const pathname = usePathname();
  if (isStandaloneRoute(pathname)) return null;
  return <GlowLayer position="fixed" variant="app" />;
}
