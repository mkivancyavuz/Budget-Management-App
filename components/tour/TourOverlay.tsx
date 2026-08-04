"use client";

// The tour's visible layer: the screen dimmed with a hole cut around the current
// target, plus the instruction bubble.
//
// z-60 — above modals (50) so it can't be buried, below the celebration (100).
// While a modal is open the overlay hides itself: pointing at something behind a
// modal is meaningless. It returns when the modal closes.
import React, { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { useTour } from "@/lib/tour/TourProvider";
import { useAnchorRect } from "@/lib/tour/useAnchorRect";
import { TourBubble } from "./TourBubble";

/** Breathing room around the highlighted element, in px. */
const PADDING = 8;

/** True while any <Modal> is mounted (it tags itself with data-modal). */
function useModalOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => setOpen(!!document.querySelector("[data-modal]"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return open;
}

export function TourOverlay() {
  const { active, step, index, total, navigating, next, back, skip, skipCurrentTarget } = useTour();
  const { t } = useLanguage();
  const modalOpen = useModalOpen();

  // Don't even look for the target until we're on its page, or the previous
  // page's DOM would be searched and the step declared missing.
  const { rect, status } = useAnchorRect(active && !navigating ? (step?.target ?? null) : null);

  // A target that never appeared is dropped from the run, whether or not it was
  // marked optional. Advancing instead would cascade: one broken anchor would
  // walk the tour to its end and write the "already seen" marker, which looks
  // identical to the tour never opening.
  useEffect(() => {
    if (!active || status !== "missing" || !step) return;
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[tour] target not found, skipping step "${step.id}" (data-tour="${step.target}")`);
    }
    skipCurrentTarget();
  }, [active, status, step, skipCurrentTarget]);

  // Keyboard: Escape leaves, arrows move.
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") skip();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") back();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, skip, next, back]);

  // Nothing to draw while a modal is open, mid-navigation, or before the target
  // has been measured.
  if (!active || !step || modalOpen) return null;

  if (!rect) {
    // Dim the screen during the gap so the tour doesn't visibly blink off while
    // a page change settles.
    return <div className="fixed inset-0 z-[60] bg-black/60" aria-hidden="true" />;
  }

  const hole = {
    top: rect.top - PADDING,
    left: rect.left - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  };

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={t(step.titleKey)}>
      {/* One element does the whole dim + hole: a transparent box the size of the
          target with an enormous spread shadow around it. Cheaper and better
          supported than four panels or a clip-path. */}
      <div
        className="absolute rounded-xl ring-2 ring-app-accent transition-all duration-200"
        style={{
          top: hole.top,
          left: hole.left,
          width: hole.width,
          height: hole.height,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
        }}
      />

      <TourBubble
        anchor={hole}
        placement={step.placement}
        title={t(step.titleKey)}
        body={t(step.bodyKey)}
        index={index}
        total={total}
        onNext={next}
        onBack={back}
        onSkip={skip}
      />
    </div>
  );
}
