# Freelance Cash Flow / Serbest Çalışan Nakit Akışı

A budgeting app for freelancers with irregular income. Built with Next.js (App Router) + TypeScript + Tailwind CSS. Available in Turkish (default) and English, with amounts shown in Turkish Lira (₺).

## Core principle

Money can only be allocated to a category if it physically exists in the account right now — the app never lets you allocate against expected/future income.

## Setup (Supabase project required)

This app is multi-tenant: every signed-in user only ever sees their own data. It needs a free [Supabase](https://supabase.com) project for auth + database.

1. Create a project at supabase.com (free tier is enough).
2. In the Supabase dashboard, go to **SQL Editor -> New query**, paste the contents of `supabase/schema.sql`, and run it. This creates the `categories`, `transactions`, `buffer_settings`, and `sessions` tables with their Row Level Security policies, plus the public `avatars` Storage bucket used for profile photos. (If you set this project up before the `sessions` table or `avatars` bucket existed, just re-run the whole file — every statement in it is idempotent / safe to re-run.)
3. Go to **Project Settings -> API Keys** and copy the **Project URL**, the **anon public / publishable** key, and the **service_role** key.
4. Copy `.env.local.example` to `.env.local` and paste all three values in. `SUPABASE_SERVICE_ROLE_KEY` is **required**, not optional — the app's own sign-in guard and every data request validate the caller against the `sessions` table using this key (see "Multi-tenancy & auth" below), so nothing works without it. This key bypasses Row Level Security — never prefix it with `NEXT_PUBLIC_`, never commit it, and in Vercel add it as a server-only environment variable.
5. (Optional but recommended) In **Authentication -> Sign In / Providers -> Email**, under "User Signups" you can turn off "Confirm email" while developing so new sign-ups don't need to click an email link.

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you'll land on `/login`. Create an account (or sign in), and you'll only ever see the categories/transactions tied to your own account. Use "Set starting balance" to enter your current cash on hand, or click "Load demo data" to explore the app with realistic sample data. Use "Clear all data" on the dashboard to wipe your own data and start over.

## Language & currency

- Toggle TR/EN in the top-right of the nav bar. The choice is remembered (`localStorage` key `freelance-budget-lang`).
- All amounts are formatted as Turkish Lira (`tr-TR` locale, `TRY` currency) via `formatCurrency()` in `lib/ledger.ts`.
- Every transaction stores a translation key + params (`labelKey`/`labelParams` in `lib/types.ts`) rather than pre-rendered text, so the same logged event displays correctly in whichever language is currently selected — including transactions logged before a language switch.

## Layout

The main content container now scales up to `1800px` on very large/ultrawide displays (previously capped at `1024px`, which left large empty margins on big monitors). Category and dashboard grids also add extra columns at `xl`/`2xl` breakpoints so wide screens show more at once instead of just stretching whitespace.

## How it works

- **Immutable ledger**: every action (income, allocation, spend, transfer, buffer contribution/draw) is logged as a double-entry transaction in `lib/store.tsx`. Account balances (unallocated cash, each category, the buffer) are never stored directly — they're always derived by summing the ledger in `lib/ledger.ts`. This is what makes the numbers auditable and prevents drift bugs.
- **Overallocation is blocked**: `allocate()` checks the unallocated balance before creating the transaction and returns a clear error if you try to allocate more than exists.
- **Overspend is handled explicitly**: `spend()` detects when an amount exceeds a category's balance and requires the user to choose whether to cover the shortfall from unallocated cash or the buffer (logged as a separate, visible "cover" transaction) before the spend itself is recorded.
- **Buffer health**: the buffer's target is `targetMonths × sum of category monthly targets` (see `lib/store.tsx`'s `bufferSettings`, editable via `setBufferSettings`). Status (Healthy / Low / Critical) is computed from configurable percentage thresholds.
- **Stale income detection**: the dashboard surfaces a warning banner if 21+ days have passed since the last logged payment, rather than silently showing old numbers.
- **Full transaction log**: `/log` shows every event and its double-entry postings for full auditability. `/history` shows monthly income totals, average, and best/worst months.

## Multi-tenancy & auth

- **Tenant model**: shared tables, discriminator column — not a database-per-tenant. `categories`, `transactions`, and `buffer_settings` (see `supabase/schema.sql`) all carry a `user_id` column, and Postgres Row Level Security policies (`using (auth.uid() = user_id)`) guarantee a request can only ever read or write rows belonging to the currently authenticated user. The tenant *is* the signed-in user — there's no separate "organization"/"workspace" concept.
- **Sessions live in Postgres, not the browser**: the browser never holds a Supabase JWT — not in `localStorage`, not in a client-readable cookie. Signing in (`app/api/auth/login`) or signing up (`app/api/auth/signup`) verifies the password against Supabase Auth once, server-side, then creates a row in a `sessions` table (`id`, `user_id`, `expires_at`) and hands the browser only an opaque, `httpOnly` cookie (`sid`) pointing at that row — see `lib/serverSession.ts`.
- **The guard checks the database on every request**: `middleware.ts` reads the `sid` cookie and makes a real query against the `sessions` table (via the service-role key) to confirm a live, unexpired session exists before letting a request through to any page or API route. There's no local JWT decoding — an invalid or revoked session is rejected at the database, not by trusting something the client presents. Signing out (`app/api/auth/logout`) deletes the row outright, so the session dies immediately rather than lingering until a token would've expired on its own.
- **Data layer**: `lib/store.tsx` no longer touches Supabase (or `localStorage`) directly at all — every read/write goes through `/api/data` (`app/api/data/route.ts`), a single server route that re-validates the `sid` session against the DB, then performs the query itself using the service-role client, always explicitly scoped to that session's `user_id`. The ledger/derivation logic in `lib/ledger.ts` is unchanged and storage-agnostic, so none of the balance math needed to change.
- **Account management** (`app/api/account/*`, see below) works the same way — every route re-resolves the caller's `user_id` from the `sessions` table before touching anything.

## Profile & account management

`/profile` (linked from the avatar at the top of the sidebar) lets a signed-in user:
- **Edit their username** — `app/api/account/update-profile/route.ts` resolves the caller's `user_id` from the `sessions` table, then updates `user_metadata.username` via the Supabase Admin API. The username is chosen at sign-up and shown beside the avatar.
- **Set a profile photo** — `app/api/account/avatar/route.ts` (POST to upload, DELETE to remove) validates the file type and size, stores it in the public `avatars` Storage bucket under a path prefixed with the uploader's own user id, and saves the resulting URL to `user_metadata.avatar_url`. Uploads only ever happen through this route using the service-role key; the browser has no Storage credentials. Replacing or removing a photo deletes the previous file so the bucket doesn't grow unbounded. With no photo set, the avatar falls back to initials on a color, both of which the user picks on the same page (`user_metadata.avatar_color` / `avatar_initials`). `lib/profile.ts` resolves all of this, and `components/Avatar.tsx` renders it, so the sidebar and profile page never disagree.
- **Change their password** — `app/api/account/update-password/route.ts`, same pattern.
- **Sign out** — its own dedicated section on the page; calls `app/api/auth/logout`, which deletes the session row.
- **Delete their account** — `app/api/account/delete/route.ts` resolves the caller's own session, then uses `lib/supabase/admin.ts` (a service-role client, server-only) to call Supabase Auth's admin API and permanently delete the account. Deleting the `auth.users` row cascades automatically to that user's `categories`, `transactions`, `buffer_settings`, and `sessions` rows via the `ON DELETE CASCADE` foreign keys in `supabase/schema.sql` — no extra cleanup code needed. The route only ever acts on the caller's own account (never accepts a target id from the request), so one tenant can't delete another's.

None of these routes ever receive or trust a Supabase JWT from the browser — they all re-derive `user_id` from the `sid` cookie via `lib/serverSession.ts`.

## Assumptions made
- **Currency**: single currency (TRY) regardless of UI language, since a freelancer's actual bank balance is in one currency. Easy to change in `lib/ledger.ts` (`formatCurrency`).
- **Languages**: only Turkish and English are implemented; adding a third language means adding one more dictionary object in `lib/i18n.tsx`.
- **Buffer target formula**: defined as N months of category monthly targets, since the spec allowed for "e.g., I want 2 months of average expenses saved" — this is editable in code (`lib/store.tsx` → `bufferSettings`) but there's no settings UI for it yet in this prototype.
- **"Import" of account balance**: the spec mentioned manual entry or import; only manual entry (a single starting-balance form) is implemented. Bank-import/Plaid-style integration is out of scope for a prototype with no backend.
- **Categories are flat** (no sub-categories/nesting), and the buffer is modeled as a special non-deletable category under the hood so it can share the same ledger mechanics as everything else.
