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
  SELECT *
  INTO promo_row
  FROM public.promotions p
  WHERE p.id = p_promotion_id
    AND p.restaurant_id = p_restaurant_id;

  IF promo_row.id IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'promotion_not_found',
      'discount_amount', 0,
      'delivery_discount_amount', 0
    );
  END IF;

  SELECT pr.reward INTO reward_payload
  FROM public.promotion_rewards pr
  WHERE pr.promotion_id = promo_row.id;

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

    RETURN jsonb_build_object(
      'valid', true,
      'reason', null,
      'discount_amount', discount_amount,
      'delivery_discount_amount', 0
    );
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

    RETURN jsonb_build_object(
      'valid', true,
      'reason', null,
      'discount_amount', 0,
      'delivery_discount_amount', GREATEST(0, delivery_discount_amount)
    );
  ELSE
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'not_implemented',
      'discount_amount', 0,
      'delivery_discount_amount', 0
    );
  END IF;
END;
$$;
