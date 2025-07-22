-- Add break_until column to restaurants table
alter table restaurants
  add column if not exists break_until timestamptz;

-- Allow null by default; no default values.
