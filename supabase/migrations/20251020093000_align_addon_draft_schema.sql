-- Align draft add-on schema with dashboard expectations and enforce stable item keys
BEGIN;

-- Ensure addon_groups_drafts columns and defaults
ALTER TABLE public.addon_groups_drafts
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS state text DEFAULT 'draft';

ALTER TABLE public.addon_groups_drafts
  ALTER COLUMN state SET DEFAULT 'draft';

UPDATE public.addon_groups_drafts
SET
  state = COALESCE(state, 'draft'),
  created_at = COALESCE(created_at, timezone('utc', now())),
  updated_at = COALESCE(updated_at, timezone('utc', now()));

ALTER TABLE public.addon_groups_drafts
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Ensure addon_options_drafts columns and defaults
ALTER TABLE public.addon_options_drafts
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS state text DEFAULT 'draft';

ALTER TABLE public.addon_options_drafts
  ALTER COLUMN state SET DEFAULT 'draft';

UPDATE public.addon_options_drafts
SET
  state = COALESCE(state, 'draft'),
  created_at = COALESCE(created_at, timezone('utc', now())),
  updated_at = COALESCE(updated_at, timezone('utc', now()));

ALTER TABLE public.addon_options_drafts
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Ensure item_addon_links_drafts columns and defaults
ALTER TABLE public.item_addon_links_drafts
  ADD COLUMN IF NOT EXISTS item_external_key text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS state text DEFAULT 'draft';

ALTER TABLE public.item_addon_links_drafts
  ALTER COLUMN state SET DEFAULT 'draft';

UPDATE public.item_addon_links_drafts
SET
  state = COALESCE(state, 'draft'),
  created_at = COALESCE(created_at, timezone('utc', now())),
  updated_at = COALESCE(updated_at, timezone('utc', now()));

ALTER TABLE public.item_addon_links_drafts
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Ensure menu_items.external_key exists and is unique per restaurant
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS external_key text;

UPDATE public.menu_items
SET external_key = 'item:' || id
WHERE external_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS menu_items_restaurant_external_key_idx
  ON public.menu_items(restaurant_id, external_key)
  WHERE external_key IS NOT NULL;

-- Indexes to support draft lookups
CREATE INDEX IF NOT EXISTS addon_groups_drafts_restaurant_idx
  ON public.addon_groups_drafts(restaurant_id);

CREATE INDEX IF NOT EXISTS addon_options_drafts_restaurant_idx
  ON public.addon_options_drafts(restaurant_id);

CREATE INDEX IF NOT EXISTS item_addon_links_drafts_restaurant_idx
  ON public.item_addon_links_drafts(restaurant_id);

CREATE INDEX IF NOT EXISTS item_addon_links_drafts_restaurant_item_idx
  ON public.item_addon_links_drafts(restaurant_id, item_id, group_id);

CREATE INDEX IF NOT EXISTS item_addon_links_drafts_restaurant_external_key_idx
  ON public.item_addon_links_drafts(restaurant_id, item_external_key, group_id);

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
