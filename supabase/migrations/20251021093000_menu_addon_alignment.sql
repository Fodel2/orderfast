-- Align live and draft add-on schema, enforce menu item keys, and expose helpers for seeding/publish
BEGIN;

-- Ensure archived_at exists on live tables
ALTER TABLE public.addon_groups
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.addon_options
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Ensure addon_groups_drafts columns
ALTER TABLE public.addon_groups_drafts
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id),
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS multiple_choice boolean,
  ADD COLUMN IF NOT EXISTS required boolean,
  ADD COLUMN IF NOT EXISTS max_group_select integer,
  ADD COLUMN IF NOT EXISTS max_option_quantity integer,
  ADD COLUMN IF NOT EXISTS state text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc', now());

ALTER TABLE public.addon_groups_drafts
  ALTER COLUMN state SET DEFAULT 'draft';

UPDATE public.addon_groups_drafts
SET
  state = COALESCE(state, 'draft'),
  created_at = COALESCE(created_at, timezone('utc', now())),
  updated_at = COALESCE(updated_at, timezone('utc', now()));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'addon_groups_drafts_restaurant_fk'
  ) THEN
    ALTER TABLE public.addon_groups_drafts
      ADD CONSTRAINT addon_groups_drafts_restaurant_fk
      FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure addon_options_drafts columns
ALTER TABLE public.addon_options_drafts
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id),
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.addon_groups_drafts(id),
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS price numeric,
  ADD COLUMN IF NOT EXISTS available boolean,
  ADD COLUMN IF NOT EXISTS out_of_stock_until timestamptz,
  ADD COLUMN IF NOT EXISTS stock_status public.stock_status_enum,
  ADD COLUMN IF NOT EXISTS stock_return_date date,
  ADD COLUMN IF NOT EXISTS stock_last_updated_at timestamptz DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS state text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc', now());

ALTER TABLE public.addon_options_drafts
  ALTER COLUMN state SET DEFAULT 'draft';

UPDATE public.addon_options_drafts
SET
  state = COALESCE(state, 'draft'),
  created_at = COALESCE(created_at, timezone('utc', now())),
  updated_at = COALESCE(updated_at, timezone('utc', now()));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'addon_options_drafts_group_fk'
  ) THEN
    ALTER TABLE public.addon_options_drafts
      ADD CONSTRAINT addon_options_drafts_group_fk
      FOREIGN KEY (group_id) REFERENCES public.addon_groups_drafts(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'addon_options_drafts_restaurant_fk'
  ) THEN
    ALTER TABLE public.addon_options_drafts
      ADD CONSTRAINT addon_options_drafts_restaurant_fk
      FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure item_addon_links_drafts columns
ALTER TABLE public.item_addon_links_drafts
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.menu_items(id),
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.addon_groups_drafts(id),
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id),
  ADD COLUMN IF NOT EXISTS item_external_key text,
  ADD COLUMN IF NOT EXISTS state text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc', now());

ALTER TABLE public.item_addon_links_drafts
  ALTER COLUMN state SET DEFAULT 'draft';

UPDATE public.item_addon_links_drafts
SET
  state = COALESCE(state, 'draft'),
  created_at = COALESCE(created_at, timezone('utc', now())),
  updated_at = COALESCE(updated_at, timezone('utc', now()));

-- Ensure menu_items.external_key exists and is unique per restaurant
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS external_key text;

UPDATE public.menu_items
SET external_key = 'item:' || id
WHERE external_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS menu_items_restaurant_external_key_idx
  ON public.menu_items(restaurant_id, external_key)
  WHERE external_key IS NOT NULL;

-- Helpful indexes for drafts
CREATE INDEX IF NOT EXISTS addon_groups_drafts_restaurant_idx
  ON public.addon_groups_drafts(restaurant_id);

CREATE INDEX IF NOT EXISTS addon_options_drafts_restaurant_idx
  ON public.addon_options_drafts(restaurant_id);

CREATE INDEX IF NOT EXISTS item_addon_links_drafts_restaurant_idx
  ON public.item_addon_links_drafts(restaurant_id);

CREATE INDEX IF NOT EXISTS item_addon_links_drafts_restaurant_item_group_idx
  ON public.item_addon_links_drafts(restaurant_id, item_external_key, group_id);

-- Seed helper function
CREATE OR REPLACE FUNCTION public.seed_addon_drafts(p_restaurant_id uuid)
RETURNS TABLE(groups_seeded integer, options_seeded integer, links_seeded integer)
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
  WITH inserted_groups AS (
    INSERT INTO public.addon_groups_drafts (
      id,
      restaurant_id,
      name,
      multiple_choice,
      required,
      max_group_select,
      max_option_quantity,
      state,
      archived_at,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      g.restaurant_id,
      g.name,
      g.multiple_choice,
      g.required,
      g.max_group_select,
      g.max_option_quantity,
      'draft',
      NULL,
      timezone('utc', now()),
      timezone('utc', now())
    FROM public.addon_groups g
    WHERE g.restaurant_id = p_restaurant_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.addon_groups_drafts gd
        WHERE gd.restaurant_id = g.restaurant_id
          AND gd.name = g.name
      )
    RETURNING id
  )
  SELECT COUNT(*)::integer INTO groups_seeded FROM inserted_groups;

  WITH inserted_options AS (
    INSERT INTO public.addon_options_drafts (
      id,
      group_id,
      restaurant_id,
      name,
      price,
      available,
      out_of_stock_until,
      stock_status,
      stock_return_date,
      stock_last_updated_at,
      state,
      archived_at,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      gd.id,
      g.restaurant_id,
      o.name,
      o.price,
      o.available,
      o.out_of_stock_until,
      o.stock_status,
      o.stock_return_date,
      COALESCE(o.stock_last_updated_at, timezone('utc', now())),
      'draft',
      NULL,
      timezone('utc', now()),
      timezone('utc', now())
    FROM public.addon_options o
    JOIN public.addon_groups g ON g.id = o.group_id
    JOIN public.addon_groups_drafts gd
      ON gd.restaurant_id = g.restaurant_id AND gd.name = g.name
    WHERE g.restaurant_id = p_restaurant_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.addon_options_drafts od
        WHERE od.restaurant_id = p_restaurant_id
          AND od.group_id = gd.id
          AND od.name = o.name
      )
    RETURNING id
  )
  SELECT COUNT(*)::integer INTO options_seeded FROM inserted_options;

  WITH inserted_links AS (
    INSERT INTO public.item_addon_links_drafts (
      id,
      item_id,
      group_id,
      restaurant_id,
      item_external_key,
      state,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      l.item_id,
      gd.id,
      g.restaurant_id,
      mi.external_key,
      'draft',
      timezone('utc', now()),
      timezone('utc', now())
    FROM public.item_addon_links l
    JOIN public.addon_groups g ON g.id = l.group_id
    JOIN public.menu_items mi ON mi.id = l.item_id
    JOIN public.addon_groups_drafts gd
      ON gd.restaurant_id = g.restaurant_id AND gd.name = g.name
    WHERE g.restaurant_id = p_restaurant_id
      AND mi.external_key IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.item_addon_links_drafts ld
        WHERE ld.restaurant_id = p_restaurant_id
          AND ld.item_external_key = mi.external_key
          AND ld.group_id = gd.id
      )
    RETURNING id
  )
  SELECT COUNT(*)::integer INTO links_seeded FROM inserted_links;

  RETURN QUERY SELECT COALESCE(groups_seeded, 0), COALESCE(options_seeded, 0), COALESCE(links_seeded, 0);
END;
$$;

-- Publish helper function handles add-ons and returns counts
CREATE OR REPLACE FUNCTION public.publish_addons_from_drafts(p_restaurant_id uuid)
RETURNS TABLE(groups_inserted integer, options_inserted integer, links_inserted integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
BEGIN
  PERFORM pg_advisory_xact_lock(9223372036854775807); -- serialize publishes

  UPDATE public.addon_options o
  SET archived_at = v_now
  FROM public.addon_groups g
  WHERE o.group_id = g.id
    AND g.restaurant_id = p_restaurant_id
    AND o.archived_at IS DISTINCT FROM v_now;

  UPDATE public.addon_groups
  SET archived_at = v_now
  WHERE restaurant_id = p_restaurant_id
    AND archived_at IS DISTINCT FROM v_now;

  INSERT INTO public.addon_groups (
    restaurant_id,
    name,
    multiple_choice,
    required,
    max_group_select,
    max_option_quantity,
    archived_at,
    created_at,
    updated_at
  )
  SELECT
    restaurant_id,
    name,
    multiple_choice,
    required,
    max_group_select,
    max_option_quantity,
    NULL,
    v_now,
    v_now
  FROM public.addon_groups_drafts
  WHERE restaurant_id = p_restaurant_id
    AND COALESCE(state, 'draft') = 'draft'
    AND archived_at IS NULL;

  SELECT COUNT(*)::integer INTO groups_inserted
  FROM public.addon_groups
  WHERE restaurant_id = p_restaurant_id
    AND created_at = v_now;

  WITH mapped_groups AS (
    SELECT
      dg.id AS draft_id,
      lg.id AS live_id
    FROM public.addon_groups_drafts dg
    JOIN public.addon_groups lg
      ON lg.restaurant_id = dg.restaurant_id
     AND lg.name = dg.name
     AND lg.created_at = v_now
  ), live_options AS (
    INSERT INTO public.addon_options (
      group_id,
      name,
      price,
      available,
      out_of_stock_until,
      stock_status,
      stock_return_date,
      stock_last_updated_at,
      archived_at,
      created_at,
      updated_at
    )
    SELECT
      mg.live_id,
      od.name,
      od.price,
      od.available,
      od.out_of_stock_until,
      od.stock_status,
      od.stock_return_date,
      COALESCE(od.stock_last_updated_at, v_now),
      NULL,
      v_now,
      v_now
    FROM public.addon_options_drafts od
    JOIN mapped_groups mg ON mg.draft_id = od.group_id
    WHERE od.restaurant_id = p_restaurant_id
      AND COALESCE(od.state, 'draft') = 'draft'
      AND od.archived_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*)::integer INTO options_inserted FROM live_options;

  WITH mapped_groups AS (
    SELECT
      dg.id AS draft_id,
      lg.id AS live_id
    FROM public.addon_groups_drafts dg
    JOIN public.addon_groups lg
      ON lg.restaurant_id = dg.restaurant_id
     AND lg.name = dg.name
     AND lg.created_at = v_now
  ), item_map AS (
    SELECT external_key, id
    FROM public.menu_items
    WHERE restaurant_id = p_restaurant_id
      AND external_key IS NOT NULL
  ), link_map AS (
    INSERT INTO public.item_addon_links (item_id, group_id)
    SELECT DISTINCT
      im.id,
      mg.live_id
    FROM public.item_addon_links_drafts ld
    JOIN mapped_groups mg ON mg.draft_id = ld.group_id
    JOIN item_map im ON im.external_key = ld.item_external_key
    WHERE ld.restaurant_id = p_restaurant_id
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*)::integer INTO links_inserted FROM link_map;

  RETURN QUERY SELECT COALESCE(groups_inserted, 0), COALESCE(options_inserted, 0), COALESCE(links_inserted, 0);
END;
$$;

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
