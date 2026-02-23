DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'promotion_status_enum'
      AND e.enumlabel = 'archived'
  ) THEN
    ALTER TYPE public.promotion_status_enum ADD VALUE 'archived';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_active_promotions_for_customer(
  p_restaurant_id uuid,
  p_customer_id uuid,
  p_now_ts timestamptz DEFAULT now(),
  p_channel text DEFAULT 'website',
  p_order_type text DEFAULT NULL,
  p_basket_subtotal numeric DEFAULT NULL
)
RETURNS SETOF public.promotions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_prior_activity boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.promotion_redemptions pr
    WHERE pr.restaurant_id = p_restaurant_id
      AND pr.customer_id = p_customer_id
  ) INTO has_prior_activity;

  RETURN QUERY
  WITH promo_base AS (
    SELECT p.*,
      (
        COALESCE(p.status IN ('active', 'scheduled'), false)
        AND p.status <> 'archived'
        AND (p.starts_at IS NULL OR p_now_ts >= p.starts_at)
        AND (p.ends_at IS NULL OR p_now_ts <= p.ends_at)
        AND (p_channel IS NULL OR p.channels @> ARRAY[p_channel]::text[])
        AND (p_order_type IS NULL OR p.order_types @> ARRAY[p_order_type]::text[])
        AND (p_basket_subtotal IS NULL OR p.min_subtotal IS NULL OR p_basket_subtotal >= p.min_subtotal)
      ) AS in_time_and_filters,
      CASE
        WHEN p.is_recurring = false THEN
          CASE
            WHEN p.starts_at IS NOT NULL AND p_now_ts < p.starts_at THEN p.starts_at
            ELSE NULL
          END
        ELSE (
          SELECT MIN(candidate_at)
          FROM (
            SELECT
              ((date_trunc('day', p_now_ts) + make_interval(days => offs.d))
                + (p.time_window_start - time '00:00:00')) AS candidate_at,
              EXTRACT(DOW FROM (date_trunc('day', p_now_ts) + make_interval(days => offs.d)))::integer AS dow_val
            FROM generate_series(0, 14) AS offs(d)
          ) next_slots
          WHERE next_slots.dow_val = ANY (p.days_of_week)
            AND next_slots.candidate_at > p_now_ts
            AND (p.starts_at IS NULL OR next_slots.candidate_at >= p.starts_at)
            AND (p.ends_at IS NULL OR next_slots.candidate_at <= p.ends_at)
        )
      END AS computed_next_available_at,
      (
        SELECT COUNT(*)::integer
        FROM public.promotion_redemptions pr
        WHERE pr.promotion_id = p.id
      ) AS used_total,
      (
        SELECT COUNT(*)::integer
        FROM public.promotion_redemptions pr
        WHERE pr.promotion_id = p.id
          AND pr.customer_id = p_customer_id
      ) AS used_by_customer
    FROM public.promotions p
    WHERE p.restaurant_id = p_restaurant_id
      AND p.status IN ('active', 'scheduled')
      AND p.status <> 'archived'
      AND (
        p.new_customer_only = false
        OR has_prior_activity = false
      )
  )
  SELECT
    pb.id,
    pb.restaurant_id,
    pb.name,
    pb.description,
    pb.type,
    pb.status,
    pb.priority,
    pb.is_recurring,
    pb.starts_at,
    pb.ends_at,
    pb.days_of_week,
    pb.time_window_start,
    pb.time_window_end,
    pb.channels,
    pb.order_types,
    pb.min_subtotal,
    pb.new_customer_only,
    pb.max_uses_total,
    pb.max_uses_per_customer,
    pb.promo_terms,
    pb.created_at,
    pb.updated_at,
    (
      pb.in_time_and_filters
      AND (NOT pb.is_recurring OR (
        EXTRACT(DOW FROM p_now_ts)::integer = ANY(pb.days_of_week)
        AND p_now_ts::time >= pb.time_window_start
        AND p_now_ts::time <= pb.time_window_end
      ))
      AND (pb.max_uses_total IS NULL OR pb.used_total < pb.max_uses_total)
      AND (pb.max_uses_per_customer IS NULL OR pb.used_by_customer < pb.max_uses_per_customer)
    ) AS is_currently_valid,
    CASE
      WHEN (
        pb.in_time_and_filters
        AND (NOT pb.is_recurring OR (
          EXTRACT(DOW FROM p_now_ts)::integer = ANY(pb.days_of_week)
          AND p_now_ts::time >= pb.time_window_start
          AND p_now_ts::time <= pb.time_window_end
        ))
        AND (pb.max_uses_total IS NULL OR pb.used_total < pb.max_uses_total)
        AND (pb.max_uses_per_customer IS NULL OR pb.used_by_customer < pb.max_uses_per_customer)
      ) THEN NULL
      ELSE pb.computed_next_available_at
    END AS next_available_at,
    CASE
      WHEN pb.max_uses_total IS NOT NULL AND pb.used_total >= pb.max_uses_total THEN 'max_uses_total_reached'
      WHEN pb.max_uses_per_customer IS NOT NULL AND pb.used_by_customer >= pb.max_uses_per_customer THEN 'max_uses_per_customer_reached'
      WHEN pb.starts_at IS NOT NULL AND p_now_ts < pb.starts_at THEN 'not_started'
      WHEN pb.ends_at IS NOT NULL AND p_now_ts > pb.ends_at THEN 'expired'
      WHEN p_channel IS NOT NULL AND NOT (pb.channels @> ARRAY[p_channel]::text[]) THEN 'channel_not_allowed'
      WHEN p_order_type IS NOT NULL AND NOT (pb.order_types @> ARRAY[p_order_type]::text[]) THEN 'order_type_not_allowed'
      WHEN p_basket_subtotal IS NOT NULL AND pb.min_subtotal IS NOT NULL AND p_basket_subtotal < pb.min_subtotal THEN 'min_subtotal_not_met'
      WHEN pb.is_recurring AND (
        NOT (EXTRACT(DOW FROM p_now_ts)::integer = ANY(pb.days_of_week))
        OR p_now_ts::time < pb.time_window_start
        OR p_now_ts::time > pb.time_window_end
      ) THEN 'outside_recurring_window'
      ELSE NULL
    END AS invalid_reason
  FROM promo_base pb
  ORDER BY pb.priority ASC, pb.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_promotion_on_checkout(
  p_restaurant_id uuid,
  p_customer_id uuid,
  p_promotion_id uuid,
  p_voucher_code text DEFAULT NULL,
  p_channel text DEFAULT 'website',
  p_order_type text DEFAULT 'delivery',
  p_basket_subtotal numeric DEFAULT 0,
  p_delivery_fee numeric DEFAULT 0,
  p_now_ts timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  promo_row public.promotions%ROWTYPE;
  reward_payload jsonb;
  voucher_row public.promotion_voucher_codes%ROWTYPE;
  total_uses integer;
  customer_uses integer;
  voucher_total_uses integer;
  voucher_customer_uses integer;
  has_prior_activity boolean;
  discount_amount numeric := 0;
  delivery_discount_amount numeric := 0;
  reward_discount_type text;
  reward_discount_value numeric;
  reward_max_discount_cap numeric;
  reward_delivery_fee_cap numeric;
  normalized_voucher_code text;
BEGIN
  SELECT * INTO promo_row
  FROM public.promotions p
  WHERE p.id = p_promotion_id
    AND p.restaurant_id = p_restaurant_id;

  IF promo_row.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'promotion_not_found', 'discount_amount', 0, 'delivery_discount_amount', 0);
  END IF;

  SELECT pr.reward INTO reward_payload
  FROM public.promotion_rewards pr
  WHERE pr.promotion_id = promo_row.id;

  IF promo_row.status = 'archived' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'archived', 'discount_amount', 0, 'delivery_discount_amount', 0);
  END IF;

  IF promo_row.status NOT IN ('active', 'scheduled') THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'status_not_active', 'discount_amount', 0, 'delivery_discount_amount', 0);
  END IF;

  IF promo_row.starts_at IS NOT NULL AND p_now_ts < promo_row.starts_at THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_started', 'discount_amount', 0, 'delivery_discount_amount', 0);
  END IF;

  IF promo_row.ends_at IS NOT NULL AND p_now_ts > promo_row.ends_at THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired', 'discount_amount', 0, 'delivery_discount_amount', 0);
  END IF;

  IF promo_row.is_recurring THEN
    IF NOT (
      EXTRACT(DOW FROM p_now_ts)::integer = ANY (promo_row.days_of_week)
      AND p_now_ts::time >= promo_row.time_window_start
      AND p_now_ts::time <= promo_row.time_window_end
    ) THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'outside_recurring_window', 'discount_amount', 0, 'delivery_discount_amount', 0);
    END IF;
  END IF;

  IF p_channel IS NOT NULL AND NOT (promo_row.channels @> ARRAY[p_channel]::text[]) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'channel_not_allowed', 'discount_amount', 0, 'delivery_discount_amount', 0);
  END IF;

  IF p_order_type IS NOT NULL AND NOT (promo_row.order_types @> ARRAY[p_order_type]::text[]) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'order_type_not_allowed', 'discount_amount', 0, 'delivery_discount_amount', 0);
  END IF;

  IF promo_row.min_subtotal IS NOT NULL AND p_basket_subtotal < promo_row.min_subtotal THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'min_subtotal_not_met', 'discount_amount', 0, 'delivery_discount_amount', 0);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.promotion_redemptions pr
    WHERE pr.restaurant_id = p_restaurant_id
      AND pr.customer_id = p_customer_id
  ) INTO has_prior_activity;

  IF promo_row.new_customer_only AND has_prior_activity THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'new_customer_only', 'discount_amount', 0, 'delivery_discount_amount', 0);
  END IF;

  SELECT COUNT(*)::integer INTO total_uses
  FROM public.promotion_redemptions pr
  WHERE pr.promotion_id = promo_row.id;

  SELECT COUNT(*)::integer INTO customer_uses
  FROM public.promotion_redemptions pr
  WHERE pr.promotion_id = promo_row.id
    AND pr.customer_id = p_customer_id;

  IF promo_row.max_uses_total IS NOT NULL AND total_uses >= promo_row.max_uses_total THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'max_uses_total_reached', 'discount_amount', 0, 'delivery_discount_amount', 0);
  END IF;

  IF promo_row.max_uses_per_customer IS NOT NULL AND customer_uses >= promo_row.max_uses_per_customer THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'max_uses_per_customer_reached', 'discount_amount', 0, 'delivery_discount_amount', 0);
  END IF;

  normalized_voucher_code := lower(btrim(COALESCE(p_voucher_code, '')));

  IF promo_row.type = 'voucher' AND normalized_voucher_code = '' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'voucher_required', 'discount_amount', 0, 'delivery_discount_amount', 0);
  END IF;

  IF normalized_voucher_code <> '' THEN
    SELECT * INTO voucher_row
    FROM public.promotion_voucher_codes pvc
    WHERE pvc.promotion_id = promo_row.id
      AND pvc.code_normalized = normalized_voucher_code
    LIMIT 1;

    IF voucher_row.id IS NULL THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'voucher_not_found', 'discount_amount', 0, 'delivery_discount_amount', 0);
    END IF;

    IF voucher_row.starts_at IS NOT NULL AND p_now_ts < voucher_row.starts_at THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'voucher_not_started', 'discount_amount', 0, 'delivery_discount_amount', 0);
    END IF;

    IF voucher_row.ends_at IS NOT NULL AND p_now_ts > voucher_row.ends_at THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'voucher_expired', 'discount_amount', 0, 'delivery_discount_amount', 0);
    END IF;

    SELECT COUNT(*)::integer INTO voucher_total_uses
    FROM public.promotion_redemptions pr
    WHERE pr.voucher_code_id = voucher_row.id;

    SELECT COUNT(*)::integer INTO voucher_customer_uses
    FROM public.promotion_redemptions pr
    WHERE pr.voucher_code_id = voucher_row.id
      AND pr.customer_id = p_customer_id;

    IF voucher_row.max_uses_total IS NOT NULL AND voucher_total_uses >= voucher_row.max_uses_total THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'voucher_max_uses_total_reached', 'discount_amount', 0, 'delivery_discount_amount', 0);
    END IF;

    IF voucher_row.max_uses_per_customer IS NOT NULL AND voucher_customer_uses >= voucher_row.max_uses_per_customer THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'voucher_max_uses_per_customer_reached', 'discount_amount', 0, 'delivery_discount_amount', 0);
    END IF;
  END IF;

  IF promo_row.type IN ('basket_discount', 'voucher') THEN
    IF reward_payload IS NULL THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'missing_reward_payload', 'discount_amount', 0, 'delivery_discount_amount', 0);
    END IF;

    reward_discount_type := reward_payload->>'discount_type';
    reward_discount_value := NULLIF(reward_payload->>'discount_value', '')::numeric;
    reward_max_discount_cap := NULLIF(reward_payload->>'max_discount_cap', '')::numeric;

    IF reward_discount_type NOT IN ('percent', 'fixed') OR reward_discount_value IS NULL OR reward_discount_value <= 0 THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'invalid_reward_payload', 'discount_amount', 0, 'delivery_discount_amount', 0);
    END IF;

    IF reward_discount_type = 'percent' THEN
      IF reward_discount_value > 100 THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'invalid_reward_payload', 'discount_amount', 0, 'delivery_discount_amount', 0);
      END IF;
      discount_amount := GREATEST(0, p_basket_subtotal * reward_discount_value / 100.0);
    ELSE
      discount_amount := GREATEST(0, reward_discount_value);
    END IF;

    IF reward_max_discount_cap IS NOT NULL THEN
      IF reward_max_discount_cap <= 0 THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'invalid_reward_payload', 'discount_amount', 0, 'delivery_discount_amount', 0);
      END IF;
      discount_amount := LEAST(discount_amount, reward_max_discount_cap);
    END IF;

    discount_amount := LEAST(discount_amount, GREATEST(0, p_basket_subtotal));

    RETURN jsonb_build_object('valid', true, 'reason', null, 'discount_amount', discount_amount, 'delivery_discount_amount', 0);
  ELSIF promo_row.type = 'delivery_promo' THEN
    IF reward_payload IS NULL THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'missing_reward_payload', 'discount_amount', 0, 'delivery_discount_amount', 0);
    END IF;

    IF reward_payload ? 'free_delivery_min_subtotal' THEN
      IF p_basket_subtotal < COALESCE(NULLIF(reward_payload->>'free_delivery_min_subtotal', '')::numeric, 0) THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'delivery_min_subtotal_not_met', 'discount_amount', 0, 'delivery_discount_amount', 0);
      END IF;
    END IF;

    reward_delivery_fee_cap := NULLIF(reward_payload->>'delivery_fee_cap', '')::numeric;

    IF reward_delivery_fee_cap IS NOT NULL THEN
      delivery_discount_amount := GREATEST(0, COALESCE(p_delivery_fee, 0) - reward_delivery_fee_cap);
    ELSE
      delivery_discount_amount := GREATEST(0, COALESCE(p_delivery_fee, 0));
    END IF;

    RETURN jsonb_build_object('valid', true, 'reason', null, 'discount_amount', 0, 'delivery_discount_amount', GREATEST(0, delivery_discount_amount));
  ELSE
    RETURN jsonb_build_object('valid', false, 'reason', 'not_implemented', 'discount_amount', 0, 'delivery_discount_amount', 0);
  END IF;
END;
$$;
