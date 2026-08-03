import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Step 1 of a password reset: ask Supabase to email a recovery link.
//
// The link lands on our own /reset-password page with a short-lived token in
// the URL fragment. That token is the proof of ownership — the browser never
// gets a Supabase session out of it; /api/auth/reset-password verifies it
// server-side before changing anything.
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const { email } = (await request.json().catch(() => ({}))) as { email?: string };
  if (!email?.trim()) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const supabase = createSupabaseClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${origin}/reset-password`,
  });

  // Deliberately reports success even when the address isn't registered:
  // answering differently would let anyone probe which emails have accounts.
  // A genuine configuration/transport failure is still surfaced.
  if (error && error.status && error.status >= 500) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
