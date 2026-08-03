"use client";

// Backdrop for the standalone auth pages (sign in, password reset): the shared
// accent glow plus a faint dot texture that the app pages don't get.
//
// Deliberately restrained — an earlier version piled on colour blobs, oversized
// ₺ glyphs and coin rings, which read as noise and fought the form for
// attention.
//
// Sits at z-0, not a negative z-index: the page wrapper paints its own
// `bg-app-bg`, and a negatively-stacked child would end up behind that
// background and never be seen. The card above carries z-10.
import { GlowLayer } from "./GlowLayer";

export function AuthBackground() {
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Fine dot grid, masked so it fades out towards the edges instead of
            ending in a hard line. */}
        <div
          className="absolute inset-0 opacity-[0.45]"
          style={{
            backgroundImage: "radial-gradient(circle, var(--border-strong) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 45%, black, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 45%, black, transparent 75%)",
          }}
        />
      </div>
      <GlowLayer />
    </>
  );
}
