-- Create enum for stock status
create type stock_status_enum as enum ('in_stock', 'scheduled', 'out');

-- Add stock columns to menu_items
alter table menu_items
  add column if not exists stock_status stock_status_enum not null default 'in_stock';

alter table menu_items
  add column if not exists stock_return_date date;

alter table menu_items
  add column if not exists stock_last_updated_at timestamptz not null default now();

alter table menu_items
  add column if not exists stock_updated_by uuid references users(id);

alter table menu_items
  add constraint if not exists menu_items_stock_return_date_check
    check (
      (stock_status = 'scheduled' and stock_return_date is not null) or
      (stock_status <> 'scheduled' and stock_return_date is null)
    );

-- Add stock columns to addon_items
alter table addon_items
  add column if not exists stock_status stock_status_enum not null default 'in_stock';

alter table addon_items
  add column if not exists stock_return_date date;

alter table addon_items
  add column if not exists stock_last_updated_at timestamptz not null default now();

alter table addon_items
  add column if not exists stock_updated_by uuid references users(id);

alter table addon_items
  add constraint if not exists addon_items_stock_return_date_check
    check (
      (stock_status = 'scheduled' and stock_return_date is not null) or
      (stock_status <> 'scheduled' and stock_return_date is null)
    );

-- Rollback
-- Drop columns and enum if needed
-- menu_items
alter table menu_items
  drop constraint if exists menu_items_stock_return_date_check;
alter table menu_items
  drop column if exists stock_status,
  drop column if exists stock_return_date,
  drop column if exists stock_last_updated_at,
  drop column if exists stock_updated_by;

-- addon_items
alter table addon_items
  drop constraint if exists addon_items_stock_return_date_check;
alter table addon_items
  drop column if exists stock_status,
  drop column if exists stock_return_date,
  drop column if exists stock_last_updated_at,
  drop column if exists stock_updated_by;

drop type if exists stock_status_enum;
