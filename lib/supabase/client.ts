"use client";

// Browser-side Supabase client. Every query issued through this client is
// automatically scoped to the signed-in user by Postgres Row Level Security
// (see supabase/schema.sql) — the app never has to filter by tenant manually,
// the database refuses to return or write rows that don't belong to auth.uid().
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
}
