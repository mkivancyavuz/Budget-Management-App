import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/serverSession";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const { email, password, username } = (await request.json()) as {
    email?: string;
    password?: string;
    username?: string;
  };
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  if (!username || !username.trim()) {
    return NextResponse.json({ error: "Username is required." }, { status: 400 });
  }

  const supabase = createSupabaseClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username: username.trim() } },
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data.user) {
    return NextResponse.json({ error: "Sign up failed." }, { status: 500 });
  }

  // If email confirmation is required, Supabase doesn't return a session yet
  // — nothing to create a DB session from until the user confirms and signs
  // in normally.
  if (!data.session) {
    return NextResponse.json({ ok: true, needsConfirmation: true });
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
