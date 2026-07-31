import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserIdForSession, SESSION_COOKIE } from "@/lib/serverSession";
import { ALLOWED_AVATAR_TYPES, MAX_AVATAR_BYTES } from "@/lib/profile";

const BUCKET = "avatars";

// Uploads a profile photo. The file goes to the `avatars` Storage bucket under
// a path prefixed with the caller's own user id (resolved from the DB-backed
// session, never from the request body), and the resulting public URL is saved
// to user_metadata.avatar_url. The browser holds no Supabase credentials, so
// this route is the only way an avatar can be written.
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const userId = await getUserIdForSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("file");
    if (value instanceof File) file = value;
  } catch {
    return NextResponse.json({ error: "invalid_upload" }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: "invalid_upload" }, { status: 400 });
  }
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
    // Timestamped filename so the public URL changes on every upload —
    // otherwise browsers and CDNs would keep serving the previous photo.
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = admin.storage.from(BUCKET).getPublicUrl(path);

    const { data: existing } = await admin.auth.admin.getUserById(userId);
    const previous = existing?.user?.user_metadata ?? {};
    const previousPath = typeof previous.avatar_path === "string" ? previous.avatar_path : null;

    const { data, error } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: { ...previous, avatar_url: publicUrl, avatar_path: path },
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Best-effort cleanup of the file this one replaced, so the bucket doesn't
    // accumulate every photo the user has ever set.
    if (previousPath && previousPath !== path) {
      await admin.storage.from(BUCKET).remove([previousPath]);
    }

    return NextResponse.json({ ok: true, user: data.user });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server misconfiguration.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Removes the uploaded photo, reverting to the colored initials avatar.
export async function DELETE() {
  const cookieStore = await cookies();
  const userId = await getUserIdForSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data: existing } = await admin.auth.admin.getUserById(userId);
    const previous = existing?.user?.user_metadata ?? {};
    const previousPath = typeof previous.avatar_path === "string" ? previous.avatar_path : null;

    const { data, error } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: { ...previous, avatar_url: null, avatar_path: null },
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (previousPath) {
      await admin.storage.from(BUCKET).remove([previousPath]);
    }
    return NextResponse.json({ ok: true, user: data.user });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server misconfiguration.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
