"use client";

// Finds a tour target in the DOM and keeps its rectangle up to date.
//
// Order matters here: the element is scrolled into view *before* its rect is
// read, because measuring first would place the bubble against an off-screen
// position. The element also may not exist yet — the tour crosses pages, so a
// step's target often appears only after a route change finishes rendering.
// Hence the MutationObserver window rather than a single query.
import { useEffect, useState } from "react";

export type AnchorStatus = "pending" | "found" | "missing";

/** How long to wait for a target to appear. Generous because a route change and
 * the data load behind it both have to finish first. */
const WAIT_MS = 2500;
/** Time allowed for smooth scrolling to settle before measuring. */
const SCROLL_SETTLE_MS = 340;

export function useAnchorRect(target: string | null): { rect: DOMRect | null; status: AnchorStatus } {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [status, setStatus] = useState<AnchorStatus>("pending");

  useEffect(() => {
    if (!target) {
      setRect(null);
      setStatus("pending");
      return;
    }

    setRect(null);
    setStatus("pending");

    let cancelled = false;
    let element: HTMLElement | null = null;
    let resize: ResizeObserver | null = null;
    let mutation: MutationObserver | null = null;
    let settleTimer = 0;
    let waitTimer = 0;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const measure = () => {
      if (cancelled || !element) return;
      const next = element.getBoundingClientRect();
      // A zero-size rect means the element is in the DOM but not laid out yet
      // (still animating in, or its container is hidden); wait for the next tick
      // rather than highlighting a 0×0 spot.
      if (next.width === 0 && next.height === 0) return;
      setRect(next);
      setStatus("found");
    };

    const attach = (found: HTMLElement) => {
      element = found;
      found.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
      settleTimer = window.setTimeout(measure, reduceMotion ? 0 : SCROLL_SETTLE_MS);

      resize = new ResizeObserver(measure);
      resize.observe(found);
      // capture: true so scrolling inside any container is picked up, not just
      // on the window.
      window.addEventListener("scroll", measure, true);
      window.addEventListener("resize", measure);
    };

    const existing = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
    if (existing) {
      attach(existing);
    } else {
      mutation = new MutationObserver(() => {
        const found = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
        if (!found) return;
        mutation?.disconnect();
        window.clearTimeout(waitTimer);
        attach(found);
      });
      mutation.observe(document.body, { childList: true, subtree: true });
      waitTimer = window.setTimeout(() => {
        mutation?.disconnect();
        if (!cancelled) setStatus("missing");
      }, WAIT_MS);
    }

    return () => {
      cancelled = true;
      window.clearTimeout(settleTimer);
      window.clearTimeout(waitTimer);
      mutation?.disconnect();
      resize?.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [target]);

  return { rect, status };
}
