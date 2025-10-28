DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'item_addon_links_drafts'
      AND column_name = 'id'
  ) THEN
    ALTER TABLE public.item_addon_links_drafts
      ADD COLUMN id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'item_addon_links_drafts'
      AND column_name = 'item_id'
  ) THEN
    ALTER TABLE public.item_addon_links_drafts
      ADD COLUMN item_id uuid REFERENCES public.menu_items(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'item_addon_links_drafts'
      AND column_name = 'group_id'
  ) THEN
    ALTER TABLE public.item_addon_links_drafts
      ADD COLUMN group_id uuid REFERENCES public.addon_groups_drafts(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'item_addon_links_drafts'
      AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE public.item_addon_links_drafts
      ADD COLUMN restaurant_id uuid REFERENCES public.restaurants(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'item_addon_links_drafts'
      AND column_name = 'state'
  ) THEN
    ALTER TABLE public.item_addon_links_drafts
      ADD COLUMN state text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'item_addon_links_drafts'
      AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.item_addon_links_drafts
      ADD COLUMN created_at timestamptz DEFAULT timezone('utc', now());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'item_addon_links_drafts'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.item_addon_links_drafts
      ADD COLUMN updated_at timestamptz DEFAULT timezone('utc', now());
  END IF;
END $$;

UPDATE public.item_addon_links_drafts
SET
  created_at = COALESCE(created_at, timezone('utc', now())),
  updated_at = COALESCE(updated_at, timezone('utc', now())),
  state = COALESCE(state, 'draft');
