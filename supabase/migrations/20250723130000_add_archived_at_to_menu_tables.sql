ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.menu_items     ADD COLUMN IF NOT EXISTS archived_at timestamptz;
