"use client";

// Tour state machine: which step is showing, how to advance, page navigation
// between steps, and the record of having seen it.
//
// "Seen it" lives on the account (user_metadata.tour_completed_at), not in
// localStorage: signing in from another browser shouldn't replay it. Skipping
// writes the same marker as finishing — replaying a tour someone deliberately
// dismissed is the most irritating thing onboarding can do.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { stepsForViewport, type TourStep } from "./steps";

interface TourShape {
  active: boolean;
  step: TourStep | null;
  /** Position within the steps that apply right now, 0-based. */
  index: number;
  /** Count of steps that apply right now. */
  total: number;
  /** True while waiting for a route change to land on the step's page. */
  navigating: boolean;
  start: () => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  /** Records that a step's target isn't present, so it can be stepped over. */
  skipCurrentTarget: () => void;
}

const TourContext = createContext<TourShape | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { user, refresh } = useAuth();
  const { loading, state } = useStore();
  const router = useRouter();
  const pathname = usePathname();

  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(true);
  /** Ids whose target turned out not to be on the page. */
  const [absent, setAbsent] = useState<string[]>([]);
  // A ref, not state: as state this was a dependency of the auto-start effect
  // below, so setting it re-ran the effect, whose cleanup cancelled the pending
  // start — the tour never opened.
  const autoStarted = useRef(false);

  // Track the breakpoint the same way the CSS does (md = 768px), so the sidebar
  // step and the mobile-header step never both apply.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    setIsDesktop(query.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const steps = useMemo(
    () => stepsForViewport(isDesktop).filter((s) => !absent.includes(s.id)),
    [isDesktop, absent]
  );

  // Clamp when the visible list shrinks under us — a resize mid-tour, or a step
  // dropping out because its target vanished.
  useEffect(() => {
    if (index > steps.length - 1) setIndex(Math.max(0, steps.length - 1));
  }, [steps.length, index]);

  const step = steps[index] ?? null;

  // The tour spans pages: when the next step lives elsewhere, navigate. The
  // anchor hook then waits for the target to appear on the new page.
  useEffect(() => {
    if (!active || !step) return;
    if (pathname !== step.route) router.push(step.route);
  }, [active, step, pathname, router]);

  const markSeen = useCallback(async () => {
    if (!user) return;
    try {
      await fetch("/api/account/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tourCompletedAt: new Date().toISOString() }),
      });
      // Pull the updated metadata so nothing re-triggers the tour this session.
      await refresh();
    } catch {
      // A failed write only means the tour may appear once more; not worth
      // interrupting the user over.
    }
  }, [user, refresh]);

  const finish = useCallback(() => {
    setActive(false);
    setIndex(0);
    void markSeen();
  }, [markSeen]);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= steps.length - 1) {
        finish();
        return i;
      }
      return i + 1;
    });
  }, [steps.length, finish]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  const skipCurrentTarget = useCallback(() => {
    if (!step) return;
    setAbsent((prev) => (prev.includes(step.id) ? prev : [...prev, step.id]));
  }, [step]);

  /** Starts from the beginning, wherever the user currently is. */
  const start = useCallback(() => {
    setAbsent([]);
    setIndex(0);
    setActive(true);
  }, []);

  /** Manual restart: also clears the "already seen" marker, so the tour is
   * genuinely reset rather than replayed once and then suppressed again. */
  const restart = useCallback(() => {
    autoStarted.current = true; // don't let the auto-start effect fight this
    void fetch("/api/account/update-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tourCompletedAt: null }),
    })
      .then(() => refresh())
      .catch(() => {});
    start();
  }, [refresh, start]);

  // Auto-start for accounts that have never seen it. Every condition matters:
  // while the store is loading, the dashboard renders only a "loading" line, so
  // none of the targets exist yet.
  useEffect(() => {
    if (autoStarted.current || active) return;
    if (!user || loading || !state.initialized) return;
    if (pathname !== "/") return;
    if (user.user_metadata?.tour_completed_at) return;

    autoStarted.current = true;
    // Started immediately, with no timer: useAnchorRect already waits for the
    // target to appear, so there's nothing to stall for here.
    start();
  }, [active, user, loading, state.initialized, pathname, start]);

  const value = useMemo<TourShape>(
    () => ({
      active: active && steps.length > 0,
      step,
      index,
      total: steps.length,
      navigating: !!step && pathname !== step.route,
      start: restart,
      next,
      back,
      skip: finish,
      skipCurrentTarget,
    }),
    [active, steps.length, step, index, pathname, restart, next, back, finish, skipCurrentTarget]
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourShape {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within a TourProvider");
  return ctx;
}
