// Server-only. Manages the app's own session table (see supabase/schema.sql)
// instead of relying on Supabase's client-held JWT/cookie. The browser never
// holds anything more than an opaque, httpOnly `sid` cookie pointing at a row
// in `public.sessions` — every check below is a real query against Postgres,
// which is what makes the sign-in "guard" (middleware.ts) and every data API
// route authoritative rather than trusting something the client presents.
import { createAdminClient } from "./supabase/admin";

export const SESSION_COOKIE = "sid";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DURATION_MS / 1000,
};

// Creates a session row for this user and returns its id — this id (never
// the user's password or a Supabase JWT) is what gets set as the `sid`
// cookie.
export async function createSession(userId: string): Promise<string> {
  const admin = createAdminClient();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  const { data, error } = await admin
    .from("sessions")
    .insert({ user_id: userId, expires_at: expiresAt })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create session.");
  return data.id as string;
}

// Deletes a session row outright (sign out, or account deletion). Once this
// row is gone, the `sid` cookie is worthless — the next request's DB check
// fails immediately, unlike a stateless JWT that would stay valid until it
// expired on its own.
export async function deleteSession(sessionId: string | undefined): Promise<void> {
  if (!sessionId) return;
  const admin = createAdminClient();
  await admin.from("sessions").delete().eq("id", sessionId);
}

// The core "guard" check used by every API route that needs to know who's
// calling: look up the session id in Postgres, confirm it hasn't expired,
// and return the user id it belongs to (or null if there's no valid
// session). Also bumps last_seen_at so the sessions table reflects real
// activity.
export async function getUserIdForSession(sessionId: string | undefined): Promise<string | null> {
  if (!sessionId) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sessions")
    .select("user_id, expires_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at as string).getTime() <= Date.now()) return null;
  void admin.from("sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", sessionId);
  return data.user_id as string;
}
