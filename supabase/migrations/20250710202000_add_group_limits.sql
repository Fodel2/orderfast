-- Add selection limit columns to addon_groups
alter table addon_groups
  add column if not exists max_group_select integer;

alter table addon_groups
  add column if not exists max_option_quantity integer;
