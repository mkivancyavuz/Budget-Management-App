import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

// Step 2 of a password reset. Takes the recovery token the emailed link put in
// the URL and the new password.
//
// The token is verified here, server-side, by asking Supabase who it belongs
// to — the client can't nominate a user id, so a forged request can't change
// someone else's password. Only then does the admin client set the password.
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const { accessToken, password } = (await request.json().catch(() => ({}))) as {
    accessToken?: string;
    password?: string;
  };

  if (!accessToken) {
    return NextResponse.json({ error: "invalid_link" }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }

  try {
    // getUser(jwt) validates the token's signature and expiry with Supabase and
    // returns the account it was issued for.
    const verifier = createSupabaseClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await verifier.auth.getUser(accessToken);
    if (error || !data.user) {
      return NextResponse.json({ error: "invalid_link" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { error: updateError } = await admin.auth.admin.updateUserById(data.user.id, { password });
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Existing sessions are dropped, so anyone holding an old cookie for this
    // account is signed out by the reset.
    await admin.from("sessions").delete().eq("user_id", data.user.id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server misconfiguration.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
