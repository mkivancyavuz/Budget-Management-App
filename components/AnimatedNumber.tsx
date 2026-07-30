"use client";

import React, { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/ledger";

function easeOutCubic(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

export function AnimatedCurrency({ value, className = "" }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const from = prevValue.current;
    const to = value;
    const start = performance.now();
    const duration = 900;

    function tick(now: number) {
      const p = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(p);
      setDisplay(from + (to - from) * eased);
      if (p < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        setDisplay(to);
        prevValue.current = to;
      }
    }
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span className={className}>{formatCurrency(display)}</span>;
}
