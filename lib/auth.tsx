"use client";

// Client-side auth context. The browser never holds a Supabase session (no
// localStorage, no client-readable cookie with a JWT in it) — it only ever
// carries an opaque httpOnly `sid` cookie that the server resolves against
// the `sessions` table on every request (see lib/serverSession.ts and
// middleware.ts). This context just asks our own /api/auth/me endpoint who
// that resolves to, for UI purposes; it has no way to read or forge a user
// itself.
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";

interface AuthShape {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthShape | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const body = await res.json();
      setUser((body.user as User) ?? null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const value = useMemo(() => ({ user, loading, refresh, signOut }), [user, loading, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthShape {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
