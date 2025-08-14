-- Create table for storing per-restaurant menu builder drafts
create table if not exists public.menu_builder_drafts (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  draft jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone not null default now()
);

-- Enable RLS and restrict access to restaurant members
alter table public.menu_builder_drafts enable row level security;

create policy "restaurant members can manage menu_builder_drafts" on public.menu_builder_drafts
  for all
  using (
    auth.uid() in (
      select user_id from restaurant_users ru
      where ru.restaurant_id = menu_builder_drafts.restaurant_id
    )
  )
  with check (
    auth.uid() in (
      select user_id from restaurant_users ru
      where ru.restaurant_id = menu_builder_drafts.restaurant_id
    )
  );
