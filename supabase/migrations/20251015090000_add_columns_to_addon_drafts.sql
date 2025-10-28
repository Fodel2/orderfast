ALTER TABLE public.addon_groups_drafts
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.addon_options_drafts
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
