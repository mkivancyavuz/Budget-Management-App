"use client";

// Renders a user's avatar: the uploaded photo if there is one, otherwise a
// colored circle with their initials (see lib/profile.ts for how those are
// resolved). Used by the sidebar and the profile page so both always agree.
import React from "react";
import type { User } from "@supabase/supabase-js";
import { avatarInfo } from "@/lib/profile";

export function Avatar({
  user,
  size,
  textClassName = "",
  className = "",
}: {
  user: User | null | undefined;
  /** Rendered diameter in px. */
  size: number;
  /** Tailwind classes for the initials text (size/weight). */
  textClassName?: string;
  className?: string;
}) {
  const { url, color, initials } = avatarInfo(user);

  return (
    <div
      style={{ width: size, height: size, backgroundColor: url ? undefined : color }}
      className={`shrink-0 rounded-full overflow-hidden flex items-center justify-center text-white font-semibold shadow-[0_4px_16px_rgba(0,0,0,0.25)] ${className}`}
    >
      {url ? (
        // A plain <img>: the file lives on the Supabase Storage CDN, and
        // next/image would need that host allow-listed in next.config for no
        // real benefit at this size.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className={textClassName}>{initials}</span>
      )}
    </div>
  );
}
