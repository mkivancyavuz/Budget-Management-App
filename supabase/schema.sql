-- Freelance Cash Flow — multi-tenant schema.
--
-- Tenancy model: SHARED TABLES, discriminator column. Every tenant's rows
-- live in the same `categories` / `transactions` / `buffer_settings` tables
-- (no per-tenant databases or schemas). Isolation is enforced by:
--   1. a `user_id uuid` column on every row (the tenant discriminator), and
--   2. Postgres Row Level Security policies that only let a request read or
--      write rows where user_id = auth.uid() — the currently authenticated
--      user from Supabase Auth.
-- This means tenant separation is guaranteed by the database itself, not by
-- application code remembering to add a WHERE clause.
--
-- Run this once in your Supabase project's SQL editor (Dashboard -> SQL Editor -> New query).

create table if not exists public.categories (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  name_key text,
  monthly_target numeric not null default 0,
  is_buffer boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null,
  date text not null,
  created_at timestamptz not null default now(),
  postings jsonb not null,
  label_key text not null,
  label_params jsonb,
  note text,
  meta jsonb
);

create table if not exists public.buffer_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  target_months numeric not null default 2,
  critical_threshold_pct numeric not null default 25,
  low_threshold_pct numeric not null default 60
);

create index if not exists categories_user_id_idx on public.categories (user_id);
create index if not exists transactions_user_id_idx on public.transactions (user_id);

alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.buffer_settings enable row level security;

drop policy if exists categories_tenant_isolation on public.categories;
create policy categories_tenant_isolation on public.categories
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists transactions_tenant_isolation on public.transactions;
create policy transactions_tenant_isolation on public.transactions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists buffer_settings_tenant_isolation on public.buffer_settings;
create policy buffer_settings_tenant_isolation on public.buffer_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
