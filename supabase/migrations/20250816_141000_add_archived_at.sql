alter table if exists public.menu_items      add column if not exists archived_at timestamptz;
alter table if exists public.menu_categories add column if not exists archived_at timestamptz;

create index if not exists idx_menu_items_restaurant_live
  on public.menu_items(restaurant_id, archived_at);
create index if not exists idx_menu_categories_restaurant_live
  on public.menu_categories(restaurant_id, archived_at);
