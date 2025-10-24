-- Add archived_at columns to addon tables to support soft archive workflow
ALTER TABLE public.addon_options
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.addon_groups
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
