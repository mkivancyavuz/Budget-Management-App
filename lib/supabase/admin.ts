// Server-only admin client. Uses the SERVICE ROLE key, which bypasses Row
// Level Security entirely — this file must never be imported from a "use
// client" component, and SUPABASE_SERVICE_ROLE_KEY must never be prefixed
// with NEXT_PUBLIC_ (that would ship it to every visitor's browser). Used by
// every app/api/** route (data access, auth, account management) after the
// caller's own session has already been resolved against the `sessions`
// table (see lib/serverSession.ts) — this is the one client that can read or
// write across tenants, so every call site must explicitly scope by the
// validated userId itself; nothing here does that automatically.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) must be set on the server to perform admin actions like account deletion."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
