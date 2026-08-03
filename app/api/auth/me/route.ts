import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserIdForSession, SESSION_COOKIE } from "@/lib/serverSession";

// Middleware already blocks this route with a 401 when there's no valid
// session (see middleware.ts), but the check is repeated here since a route
// handler should never assume it was reached only through the guard.
export async function GET() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE)?.value;
  const userId = await getUserIdForSession(sid);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ user: data.user });
}
