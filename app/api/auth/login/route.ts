import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/serverSession";

// Password verification still goes through Supabase Auth (it's the system of
// record for credentials/hashing). But the resulting Supabase JWT is used
// once, right here on the server, and then thrown away — the browser never
// sees it. What the browser gets back is an opaque `sid` cookie pointing at
// a row in our own `sessions` table (see lib/serverSession.ts), which is
// what every subsequent request is checked against.
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const { email, password } = (await request.json()) as { email?: string; password?: string };
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const supabase = createSupabaseClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "Sign in failed." }, { status: 401 });
  }

  try {
    const sessionId = await createSession(data.user.id);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, sessionId, sessionCookieOptions);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
