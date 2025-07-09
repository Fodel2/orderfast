-- Add 'status' column with default 'live' to menu tables
alter table menu_categories
  add column if not exists status text not null default 'live';

alter table menu_items
  add column if not exists status text not null default 'live';
