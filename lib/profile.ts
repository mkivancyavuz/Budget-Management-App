// Avatar resolution shared by the sidebar and the profile page, so both
// always render the same thing.
//
// An avatar is one of two things, in priority order:
//   1. An uploaded photo (`user_metadata.avatar_url`, stored in the
//      `avatars` Supabase Storage bucket — see README).
//   2. A colored circle with initials, both of which the user can pick
//      (`user_metadata.avatar_color` / `avatar_initials`), falling back to
//      the accent color and the first letter of their username or email.
import type { User } from "@supabase/supabase-js";

/** The palette offered in the profile page's avatar color picker. */
export const AVATAR_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#64748b",
];

export const DEFAULT_AVATAR_COLOR = AVATAR_COLORS[0];

/** Max upload size for an avatar image, in bytes. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

export const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Kept for the legacy call sites — one letter from an email address. */
export function initialsFromEmail(email?: string | null): string {
  if (!email) return "?";
  return email[0]?.toUpperCase() ?? "?";
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export interface AvatarInfo {
  url: string | null;
  color: string;
  initials: string;
}

/** Everything needed to render this user's avatar, with all fallbacks applied. */
export function avatarInfo(user: User | null | undefined): AvatarInfo {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const url = typeof meta.avatar_url === "string" && meta.avatar_url ? meta.avatar_url : null;
  const color =
    typeof meta.avatar_color === "string" && meta.avatar_color ? meta.avatar_color : DEFAULT_AVATAR_COLOR;

  const custom = typeof meta.avatar_initials === "string" ? meta.avatar_initials.trim() : "";
  const username = typeof meta.username === "string" ? meta.username : "";
  const initials = custom
    ? custom.slice(0, 2).toUpperCase()
    : username
      ? initialsFromName(username)
      : initialsFromEmail(user?.email);

  return { url, color, initials };
}

/** The name to show beside the avatar: the chosen username, else the email. */
export function displayIdentity(user: User | null | undefined): string {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  if (typeof meta.username === "string" && meta.username.trim()) return meta.username.trim();
  return user?.email ?? "";
}
