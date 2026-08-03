import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserIdForSession, SESSION_COOKIE } from "@/lib/serverSession";

// Runs entirely server-side via the admin client, keyed off the session we
// already validated against the DB — the browser never needs a Supabase
// session/JWT of its own to make this change.
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE)?.value;
  const userId = await getUserIdForSession(sid);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { fullName, username, avatarColor, avatarInitials } = (await request.json().catch(() => ({}))) as {
    fullName?: string;
    username?: string;
    avatarColor?: string;
    avatarInitials?: string;
  };

  const admin = createAdminClient();

  // Fetch first and merge rather than overwrite — user_metadata holds both
  // full_name and username (set at signup), and we only want to touch the
  // field this form actually edited.
  const { data: existing, error: fetchError } = await admin.auth.admin.getUserById(userId);
  if (fetchError || !existing.user) {
    return NextResponse.json({ error: fetchError?.message ?? "User not found." }, { status: 400 });
  }

  const nextMetadata: Record<string, unknown> = { ...existing.user.user_metadata };
  if (fullName !== undefined) nextMetadata.full_name = fullName.trim();
  if (username !== undefined) nextMetadata.username = username.trim();
  // Only accept a plain hex color, so nothing arbitrary ends up being
  // interpolated into an inline style downstream.
  if (avatarColor !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(avatarColor)) {
      return NextResponse.json({ error: "invalid_color" }, { status: 400 });
    }
    nextMetadata.avatar_color = avatarColor;
  }
  if (avatarInitials !== undefined) nextMetadata.avatar_initials = avatarInitials.trim().slice(0, 2);

  const { data, error } = await admin.auth.admin.updateUserById(userId, { user_metadata: nextMetadata });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, user: data.user });
}
