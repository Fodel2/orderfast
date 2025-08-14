ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;
ALTER TABLE public.menu_items     ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;
