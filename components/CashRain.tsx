"use client";

// One-shot celebration: a huge currency sign pops up and banknotes rain down
// the screen, then it clears itself away.
//
// No library and no image files — the notes are styled divs and the animation
// is CSS keyframes (see globals.css), so this costs nothing to load. The layer
// is aria-hidden and pointer-events-none: decorative, and it must never
// swallow a click while it's on screen.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { playCashSound } from "@/lib/sound";

// The overlay must outlive its slowest note, or late ones get cut off halfway
// down the screen: MAX_DELAY + MAX_FALL is the floor for DURATION_MS.
const MAX_DELAY = 1.8; // s
const MAX_FALL = 3.2; // s
const DURATION_MS = (MAX_DELAY + MAX_FALL) * 1000 + 400;
const NOTE_COUNT = 130;

interface Note {
  id: number;
  left: number; // vw
  delay: number; // s
  duration: number; // s
  size: number; // px
  spinFrom: number; // deg
  spinTo: number; // deg
  glyph: string;
  tone: string;
}

// Weighted by repetition — mostly currency signs, with the occasional banknote
// and coin so the rain isn't uniform.
const GLYPHS = ["$", "$", "$", "₺", "₺", "€", "💵", "💰", "🪙"];
const TONES = ["#22c55e", "#16a34a", "#4ade80", "#86efac", "#facc15", "#fde047"];

export function CashRain({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  // Generated once per mount. This component only ever mounts in response to a
  // client-side event, so the randomness can't cause a hydration mismatch.
  const notes = useMemo<Note[]>(
    () =>
      Array.from({ length: NOTE_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 98,
        delay: Math.random() * MAX_DELAY,
        duration: 1.9 + Math.random() * (MAX_FALL - 1.9),
        size: 14 + Math.random() * 30,
        spinFrom: Math.random() * 120 - 60,
        spinTo: Math.random() * 720 - 360,
        glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
        tone: TONES[Math.floor(Math.random() * TONES.length)],
      })),
    []
  );

  // Held in a ref so the effect below can have empty deps. `onDone` is usually
  // an inline arrow from the parent, i.e. a new function on every render — with
  // it in the dep array the effect re-ran on every unrelated re-render, which
  // replayed the sound and reset the timers while the animation was still on
  // screen.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // Mount only: the sound plays once and the teardown is scheduled once.
  useEffect(() => {
    playCashSound();
    const done = setTimeout(() => onDoneRef.current(), DURATION_MS);
    // Fade the whole layer slightly before unmount so nothing pops out.
    const fade = setTimeout(() => setLeaving(true), DURATION_MS - 600);
    return () => {
      clearTimeout(done);
      clearTimeout(fade);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-[100] overflow-hidden transition-opacity duration-500 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      {notes.map((note) => (
        <span
          key={note.id}
          className="animate-money-fall absolute top-0 select-none font-bold drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
          style={
            {
              left: `${note.left}vw`,
              fontSize: `${note.size}px`,
              color: note.tone,
              animationDelay: `${note.delay}s`,
              animationDuration: `${note.duration}s`,
              "--spin-from": `${note.spinFrom}deg`,
              "--spin-to": `${note.spinTo}deg`,
            } as React.CSSProperties
          }
        >
          {note.glyph}
        </span>
      ))}

      <div className="absolute inset-0 flex items-center justify-center">
        <span className="animate-jackpot-sign text-[28vw] sm:text-[20vw] leading-none font-bold text-app-success drop-shadow-[0_0_60px_rgba(34,197,94,0.55)]">
          $
        </span>
      </div>
    </div>
  );
}
