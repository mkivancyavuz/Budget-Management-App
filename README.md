# Freelance Cash Flow / Serbest Çalışan Nakit Akışı

A budgeting app for freelancers with irregular income. Built with Next.js (App Router) + TypeScript + Tailwind CSS. Available in Turkish (default) and English, with amounts shown in Turkish Lira (₺).

## Core principle

Money can only be allocated to a category if it physically exists in the account right now — the app never lets you allocate against expected/future income.

## Setup (Supabase project required)

This app is multi-tenant: every signed-in user only ever sees their own data. It needs a free [Supabase](https://supabase.com) project for auth + database.

1. Create a project at supabase.com (free tier is enough).
2. In the Supabase dashboard, go to **SQL Editor -> New query**, paste the contents of `supabase/schema.sql`, and run it. This creates the `categories`, `transactions`, and `buffer_settings` tables and their Row Level Security policies.
3. Go to **Project Settings -> API** and copy the **Project URL** and **anon public** key.
4. Copy `.env.local.example` to `.env.local` and paste those two values in.
5. (Optional but recommended) In **Authentication -> Providers -> Email**, you can turn off "Confirm email" while developing so new sign-ups don't need to click an email link.

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
- **Auth**: Supabase Auth (email + password), the free tier of the same Supabase project as the database. `middleware.ts` protects every route except `/login`, redirecting signed-out visitors there and signed-in visitors away from it. `lib/auth.tsx` exposes the current user + `signOut()` to client components; the sidebar/mobile nav show the signed-in email and a sign-out button.
- **Data layer**: `lib/store.tsx` no longer touches `localStorage` at all — every read/write goes through `lib/supabase/client.ts` (browser) scoped automatically to the logged-in user by RLS. The ledger/derivation logic in `lib/ledger.ts` is unchanged and storage-agnostic, so none of the balance math needed to change.

## Assumptions made
- **Currency**: single currency (TRY) regardless of UI language, since a freelancer's actual bank balance is in one currency. Easy to change in `lib/ledger.ts` (`formatCurrency`).
- **Languages**: only Turkish and English are implemented; adding a third language means adding one more dictionary object in `lib/i18n.tsx`.
- **Buffer target formula**: defined as N months of category monthly targets, since the spec allowed for "e.g., I want 2 months of average expenses saved" — this is editable in code (`lib/store.tsx` → `bufferSettings`) but there's no settings UI for it yet in this prototype.
- **"Import" of account balance**: the spec mentioned manual entry or import; only manual entry (a single starting-balance form) is implemented. Bank-import/Plaid-style integration is out of scope for a prototype with no backend.
- **Categories are flat** (no sub-categories/nesting), and the buffer is modeled as a special non-deletable category under the hood so it can share the same ledger mechanics as everything else.
