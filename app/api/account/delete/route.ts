import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserIdForSession, SESSION_COOKIE } from "@/lib/serverSession";

// Deletes the CALLING user's own account and all their data. Never accepts
// a user id from the request body — the target is always whoever the `sid`
// session cookie resolves to in our own `sessions` table (see
// lib/serverSession.ts), so one tenant can never delete another's account.
// The caller must also re-enter their password, which is verified against
// Supabase Auth here before anything is destroyed — a stolen session cookie
// alone is not enough to wipe an account.
// categories/transactions/buffer_settings/sessions rows are removed
// automatically via ON DELETE CASCADE on their user_id foreign key
// (see supabase/schema.sql).
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE)?.value;
  const userId = await getUserIdForSession(sid);

  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  if (!password) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    const { data: existing, error: fetchError } = await admin.auth.admin.getUserById(userId);
    if (fetchError || !existing.user?.email) {
      return NextResponse.json({ error: fetchError?.message ?? "User not found." }, { status: 400 });
    }

    // Re-authenticate with the password the user just typed. Uses a throwaway
    // anon client so this check can't disturb the caller's own session.
    const verifier = createSupabaseClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInError } = await verifier.auth.signInWithPassword({
      email: existing.user.email,
      password,
    });
    if (signInError) {
      return NextResponse.json({ error: "invalid_password" }, { status: 401 });
    }

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    cookieStore.delete(SESSION_COOKIE);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server misconfiguration.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
