"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";

export type Theme = "dark" | "light";

export const THEME_KEY = "freelance-budget-theme";

/** Inline, blocking script source — read once by <script> in the root layout,
 * before React hydrates, so the correct theme applies on first paint with no
 * flash. It only ever reads/writes localStorage; the theme is never put in
 * the URL (no query string, no route segment). */
export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("${THEME_KEY}");
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();
`;

interface ThemeShape {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeShape | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    // The blocking inline script already set data-theme on <html> before hydration —
    // just read it back so React state matches what's already painted.
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") setThemeState(current);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    try {
      window.localStorage.setItem(THEME_KEY, t);
    } catch {
      // storage unavailable — theme still applies for this session
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeShape {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
