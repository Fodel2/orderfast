-- Ensure addon group/option sort_order is preserved on publish
BEGIN;

CREATE OR REPLACE FUNCTION public.publish_addons_from_drafts(p_restaurant_id uuid)
RETURNS TABLE(groups_inserted integer, options_inserted integer, links_inserted integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
BEGIN
  PERFORM pg_advisory_xact_lock(9223372036854775807);

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
    sort_order,
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
    sort_order,
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
      sort_order,
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
      od.sort_order,
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

  RETURN QUERY SELECT COALESCE(groups_inserted, 0), COALESCE(options_inserted, 0), 0;
END;
$$;

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
