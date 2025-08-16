create extension if not exists pgcrypto;

create table if not exists public.menu_builder_drafts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_drafts_restaurant_id
  on public.menu_builder_drafts(restaurant_id);

alter table public.menu_builder_drafts enable row level security;

-- Server API uses service role; allow it explicitly.
drop policy if exists drafts_service_bypass on public.menu_builder_drafts;
create policy drafts_service_bypass
  on public.menu_builder_drafts for all
  to service_role
  using (true)
  with check (true);
