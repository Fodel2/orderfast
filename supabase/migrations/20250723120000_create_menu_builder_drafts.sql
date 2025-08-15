create table if not exists public.menu_builder_drafts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.menu_builder_drafts enable row level security;

drop policy if exists "drafts read own" on public.menu_builder_drafts;
create policy "drafts read own"
  on public.menu_builder_drafts
  for select
  using (restaurant_id = auth.uid());

drop policy if exists "drafts upsert own" on public.menu_builder_drafts;
create policy "drafts upsert own"
  on public.menu_builder_drafts
  for insert
  with check (restaurant_id = auth.uid());

create policy if not exists "drafts update own"
  on public.menu_builder_drafts
  for update
  using (restaurant_id = auth.uid());
