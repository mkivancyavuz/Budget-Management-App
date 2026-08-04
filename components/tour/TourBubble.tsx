"use client";

// The tour's instruction card, positioned next to the highlighted element.
//
// Placement is a preference, not a promise: the requested side is used when it
// fits, otherwise the bubble flips to the opposite side, and either way it's
// clamped inside the viewport. Without that, a step near the bottom or the right
// edge would put its bubble half off-screen.
import React, { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { Button } from "../ui";

interface Anchor {
  top: number;
  left: number;
  width: number;
  height: number;
}

const GAP = 12;
const MARGIN = 12;
const WIDTH = 320;

export function TourBubble({
  anchor,
  placement,
  title,
  body,
  index,
  total,
  onNext,
  onBack,
  onSkip,
}: {
  anchor: Anchor;
  placement: "top" | "bottom" | "left" | "right";
  title: string;
  body: string;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(170);

  // The bubble's own height decides whether the preferred side fits, so it's
  // measured after render rather than guessed.
  useEffect(() => {
    if (ref.current) setHeight(ref.current.offsetHeight);
  }, [title, body]);

  // Move focus here on every step so keyboard and screen-reader users follow
  // along instead of being left behind on the page.
  useEffect(() => {
    ref.current?.focus();
  }, [index]);

  const vw = typeof window === "undefined" ? 1024 : window.innerWidth;
  const vh = typeof window === "undefined" ? 768 : window.innerHeight;

  let side = placement;
  if (side === "bottom" && anchor.top + anchor.height + GAP + height > vh - MARGIN) side = "top";
  else if (side === "top" && anchor.top - GAP - height < MARGIN) side = "bottom";
  else if (side === "right" && anchor.left + anchor.width + GAP + WIDTH > vw - MARGIN) side = "left";
  else if (side === "left" && anchor.left - GAP - WIDTH < MARGIN) side = "right";

  let top: number;
  let left: number;
  if (side === "bottom") {
    top = anchor.top + anchor.height + GAP;
    left = anchor.left + anchor.width / 2 - WIDTH / 2;
  } else if (side === "top") {
    top = anchor.top - GAP - height;
    left = anchor.left + anchor.width / 2 - WIDTH / 2;
  } else if (side === "right") {
    top = anchor.top + anchor.height / 2 - height / 2;
    left = anchor.left + anchor.width + GAP;
  } else {
    top = anchor.top + anchor.height / 2 - height / 2;
    left = anchor.left - GAP - WIDTH;
  }

  // Keep it on screen whatever the anchor did.
  left = Math.min(Math.max(MARGIN, left), vw - WIDTH - MARGIN);
  top = Math.min(Math.max(MARGIN, top), vh - height - MARGIN);

  const isLast = index >= total - 1;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      aria-live="polite"
      style={{ top, left, width: WIDTH }}
      className="absolute max-w-[calc(100vw-1.5rem)] rounded-2xl border border-app-border bg-app-surface p-4 shadow-2xl outline-none"
    >
      <p className="text-[11px] font-semibold text-app-accent mb-1">
        {t("tour_progress", { current: index + 1, total })}
      </p>
      <h2 className="text-sm font-semibold text-app-text mb-1.5">{title}</h2>
      <p className="text-[13px] leading-relaxed text-app-text-secondary mb-4">{body}</p>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs font-medium text-app-text-muted hover:text-app-text transition-colors"
        >
          {t("tour_skip")}
        </button>
        <div className="flex items-center gap-2">
          {index > 0 && (
            <Button variant="secondary" onClick={onBack}>
              {t("tour_back")}
            </Button>
          )}
          <Button onClick={onNext}>{isLast ? t("tour_finish") : t("tour_next")}</Button>
        </div>
      </div>
    </div>
  );
}
