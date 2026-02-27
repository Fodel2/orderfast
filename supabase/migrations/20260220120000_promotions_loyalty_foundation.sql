-- Promotions + Loyalty foundation schema for Orderfast.
-- Minimal assumptions: only references public.restaurants(id) and auth.users(id) are guaranteed.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promotion_status_enum') THEN
    CREATE TYPE public.promotion_status_enum AS ENUM ('draft', 'scheduled', 'active', 'paused', 'expired');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promotion_type_enum') THEN
    CREATE TYPE public.promotion_type_enum AS ENUM (
      'basket_discount',
      'voucher',
      'multibuy_bogo',
      'spend_get_item',
      'bundle_fixed_price',
      'delivery_promo',
      'loyalty_redemption'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discount_value_type_enum') THEN
    CREATE TYPE public.discount_value_type_enum AS ENUM ('percent', 'fixed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.restaurant_promo_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL UNIQUE REFERENCES public.restaurants(id) ON DELETE CASCADE,
  global_terms text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  type public.promotion_type_enum NOT NULL,
  status public.promotion_status_enum NOT NULL DEFAULT 'draft',
  priority integer NOT NULL DEFAULT 100,
  is_recurring boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  days_of_week integer[], -- 0=Sunday .. 6=Saturday
  time_window_start time,
  time_window_end time,
  channels text[] NOT NULL DEFAULT ARRAY['website']::text[],
  order_types text[] NOT NULL DEFAULT ARRAY['delivery','collection']::text[],
  min_subtotal numeric,
  new_customer_only boolean NOT NULL DEFAULT false,
  max_uses_total integer,
  max_uses_per_customer integer,
  promo_terms text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promotions_recurring_window_check CHECK (
    (
      is_recurring = true
      AND days_of_week IS NOT NULL
      AND cardinality(days_of_week) > 0
      AND time_window_start IS NOT NULL
      AND time_window_end IS NOT NULL
    ) OR (
      is_recurring = false
      AND days_of_week IS NULL
      AND time_window_start IS NULL
      AND time_window_end IS NULL
    )
  ),
  CONSTRAINT promotions_starts_before_ends_check CHECK (
    starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at
  )
);

CREATE INDEX IF NOT EXISTS promotions_restaurant_id_idx
  ON public.promotions (restaurant_id);
CREATE INDEX IF NOT EXISTS promotions_restaurant_status_priority_idx
  ON public.promotions (restaurant_id, status, priority, starts_at);

CREATE TABLE IF NOT EXISTS public.promotion_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL UNIQUE REFERENCES public.promotions(id) ON DELETE CASCADE,
  reward jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.promotion_rewards.reward IS
'JSON reward payload by promotion type (schema-by-convention):
- basket_discount: {"discount_type":"percent|fixed", "discount_value":10, "max_discount_cap":5}
- delivery_promo: {"free_delivery_min_subtotal":20, "delivery_fee_cap":3} where cap is customer payable delivery fee; omit cap for fully free delivery
- multibuy_bogo: {"required_items":[{"item_id":"uuid","qty":1}], "reward_items":[{"item_id":"uuid","qty":1,"discount_percent":100}], "mode":"bogo_free|bogo_half|buyx_gety_percent"}
- spend_get_item: {"min_subtotal":25, "reward_item_id":"uuid", "reward_qty":1}
- bundle_fixed_price: {"pool_items":["uuid"], "pool_categories":["uuid"], "required_qty":3, "bundle_price":15}
';

CREATE TABLE IF NOT EXISTS public.promotion_voucher_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  code text NOT NULL,
  code_normalized text GENERATED ALWAYS AS (lower(code)) STORED,
  max_uses_total integer,
  max_uses_per_customer integer,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promotion_voucher_codes_code_normalized_unique UNIQUE (code_normalized),
  CONSTRAINT promotion_voucher_codes_code_not_blank_check CHECK (btrim(code) <> ''),
  CONSTRAINT promotion_voucher_codes_starts_before_ends_check CHECK (
    starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at
  )
);

ALTER TABLE public.promotion_voucher_codes
  DROP CONSTRAINT IF EXISTS promotion_voucher_codes_code_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'promotion_voucher_codes_code_not_blank_check'
      AND conrelid = 'public.promotion_voucher_codes'::regclass
  ) THEN
    ALTER TABLE public.promotion_voucher_codes
      ADD CONSTRAINT promotion_voucher_codes_code_not_blank_check CHECK (btrim(code) <> '');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS promotion_voucher_codes_promotion_id_idx
  ON public.promotion_voucher_codes (promotion_id);

CREATE TABLE IF NOT EXISTS public.promotion_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  voucher_code_id uuid REFERENCES public.promotion_voucher_codes(id) ON DELETE SET NULL,
  customer_id uuid,
  order_id uuid,
  channel text,
  order_type text,
  basket_subtotal numeric,
  discount_amount numeric NOT NULL DEFAULT 0,
  delivery_discount_amount numeric NOT NULL DEFAULT 0,
  points_spent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promotion_redemptions_restaurant_id_idx
  ON public.promotion_redemptions (restaurant_id);
CREATE INDEX IF NOT EXISTS promotion_redemptions_promotion_id_idx
  ON public.promotion_redemptions (promotion_id);
CREATE INDEX IF NOT EXISTS promotion_redemptions_customer_id_idx
  ON public.promotion_redemptions (customer_id);
CREATE INDEX IF NOT EXISTS promotion_redemptions_created_at_idx
  ON public.promotion_redemptions (created_at);

CREATE TABLE IF NOT EXISTS public.loyalty_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL UNIQUE REFERENCES public.restaurants(id) ON DELETE CASCADE,
  points_per_currency_unit numeric NOT NULL DEFAULT 1,
  min_redeem_currency numeric NOT NULL DEFAULT 1,
  max_redeem_currency numeric,
  points_expire_days integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loyalty_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('earn','spend','adjust')),
  points integer NOT NULL,
  currency_value numeric NOT NULL DEFAULT 0,
  ref_order_id uuid,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS loyalty_ledger_restaurant_customer_created_idx
  ON public.loyalty_ledger (restaurant_id, customer_id, created_at);

DROP TRIGGER IF EXISTS trg_promotions_updated_at ON public.promotions;
CREATE TRIGGER trg_promotions_updated_at
BEFORE UPDATE ON public.promotions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_loyalty_config_updated_at ON public.loyalty_config;
CREATE TRIGGER trg_loyalty_config_updated_at
BEFORE UPDATE ON public.loyalty_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_restaurant_promo_terms_updated_at ON public.restaurant_promo_terms;
CREATE TRIGGER trg_restaurant_promo_terms_updated_at
BEFORE UPDATE ON public.restaurant_promo_terms
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.restaurant_promo_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_voucher_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;

-- Core membership helper expression is repeated inline to keep migration self-contained.

DROP POLICY IF EXISTS "Members manage restaurant promo terms" ON public.restaurant_promo_terms;
CREATE POLICY "Members manage restaurant promo terms"
ON public.restaurant_promo_terms
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurant_users ru
    WHERE ru.restaurant_id = restaurant_promo_terms.restaurant_id
      AND ru.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurant_users ru
    WHERE ru.restaurant_id = restaurant_promo_terms.restaurant_id
      AND ru.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members manage promotions" ON public.promotions;
CREATE POLICY "Members manage promotions"
ON public.promotions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurant_users ru
    WHERE ru.restaurant_id = promotions.restaurant_id
      AND ru.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurant_users ru
    WHERE ru.restaurant_id = promotions.restaurant_id
      AND ru.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members manage promotion rewards" ON public.promotion_rewards;
CREATE POLICY "Members manage promotion rewards"
ON public.promotion_rewards
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.promotions p
    JOIN public.restaurant_users ru ON ru.restaurant_id = p.restaurant_id
    WHERE p.id = promotion_rewards.promotion_id
      AND ru.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.promotions p
    JOIN public.restaurant_users ru ON ru.restaurant_id = p.restaurant_id
    WHERE p.id = promotion_rewards.promotion_id
      AND ru.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members manage promotion voucher codes" ON public.promotion_voucher_codes;
CREATE POLICY "Members manage promotion voucher codes"
ON public.promotion_voucher_codes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.promotions p
    JOIN public.restaurant_users ru ON ru.restaurant_id = p.restaurant_id
    WHERE p.id = promotion_voucher_codes.promotion_id
      AND ru.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.promotions p
    JOIN public.restaurant_users ru ON ru.restaurant_id = p.restaurant_id
    WHERE p.id = promotion_voucher_codes.promotion_id
      AND ru.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members manage loyalty config" ON public.loyalty_config;
CREATE POLICY "Members manage loyalty config"
ON public.loyalty_config
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurant_users ru
    WHERE ru.restaurant_id = loyalty_config.restaurant_id
      AND ru.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurant_users ru
    WHERE ru.restaurant_id = loyalty_config.restaurant_id
      AND ru.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members read promotion redemptions" ON public.promotion_redemptions;
CREATE POLICY "Members read promotion redemptions"
ON public.promotion_redemptions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurant_users ru
    WHERE ru.restaurant_id = promotion_redemptions.restaurant_id
      AND ru.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members insert promotion redemptions" ON public.promotion_redemptions;
CREATE POLICY "Members insert promotion redemptions"
ON public.promotion_redemptions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurant_users ru
    WHERE ru.restaurant_id = promotion_redemptions.restaurant_id
      AND ru.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members read loyalty ledger" ON public.loyalty_ledger;
CREATE POLICY "Members read loyalty ledger"
ON public.loyalty_ledger
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurant_users ru
    WHERE ru.restaurant_id = loyalty_ledger.restaurant_id
      AND ru.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members insert loyalty ledger" ON public.loyalty_ledger;
CREATE POLICY "Members insert loyalty ledger"
ON public.loyalty_ledger
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurant_users ru
    WHERE ru.restaurant_id = loyalty_ledger.restaurant_id
      AND ru.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.get_active_promotions_for_customer(
  p_restaurant_id uuid,
  p_customer_id uuid,
  p_now_ts timestamptz DEFAULT now(),
  p_channel text DEFAULT 'website',
  p_order_type text DEFAULT 'delivery',
  p_basket_subtotal numeric DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  restaurant_id uuid,
  name text,
  description text,
  type public.promotion_type_enum,
  status public.promotion_status_enum,
  priority integer,
  is_recurring boolean,
  starts_at timestamptz,
  ends_at timestamptz,
  days_of_week integer[],
  time_window_start time,
  time_window_end time,
  channels text[],
  order_types text[],
  min_subtotal numeric,
  new_customer_only boolean,
  max_uses_total integer,
  max_uses_per_customer integer,
  promo_terms text,
  created_at timestamptz,
  updated_at timestamptz,
  is_currently_valid boolean,
  next_available_at timestamptz,
  invalid_reason text
)
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

CREATE OR REPLACE FUNCTION public.redeem_loyalty_points_to_voucher(
  p_restaurant_id uuid,
  p_customer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  loyalty_row RECORD;
  current_points integer := 0;
  points_to_spend integer;
  voucher_currency_value numeric;
  loyalty_promotion_id uuid;
  reward_payload jsonb;
  voucher_code_id uuid;
  voucher_code text;
  reward_title text;
BEGIN
  SELECT
    lc.enabled,
    lc.points_per_currency_unit,
    lc.reward_points_required,
    lc.reward_value
  INTO loyalty_row
  FROM public.loyalty_config lc
  WHERE lc.restaurant_id = p_restaurant_id;

  IF loyalty_row IS NULL OR COALESCE(loyalty_row.enabled, false) = false THEN
    RAISE EXCEPTION 'Loyalty is not enabled for this restaurant';
  END IF;

  points_to_spend := GREATEST(1, COALESCE(loyalty_row.reward_points_required, 0));
  voucher_currency_value := GREATEST(0, COALESCE(loyalty_row.reward_value, 0));

  SELECT COALESCE(SUM(
    CASE
      WHEN ll.entry_type = 'spend' THEN -ABS(ll.points)
      ELSE ll.points
    END
  ), 0)::integer
  INTO current_points
  FROM public.loyalty_ledger ll
  WHERE ll.restaurant_id = p_restaurant_id
    AND ll.customer_id = p_customer_id;

  IF current_points < points_to_spend THEN
    RAISE EXCEPTION 'Insufficient loyalty points';
  END IF;

  SELECT p.id
  INTO loyalty_promotion_id
  FROM public.promotions p
  WHERE p.restaurant_id = p_restaurant_id
    AND p.type = 'voucher'
    AND p.name = 'Loyalty Voucher'
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF loyalty_promotion_id IS NULL THEN
    INSERT INTO public.promotions (
      restaurant_id,
      name,
      type,
      status,
      priority,
      channels,
      order_types,
      is_recurring,
      promo_terms
    ) VALUES (
      p_restaurant_id,
      'Loyalty Voucher',
      'voucher',
      'active',
      100,
      ARRAY['website']::text[],
      ARRAY['delivery','collection']::text[],
      false,
      'Loyalty voucher generated from points redemption.'
    )
    RETURNING id INTO loyalty_promotion_id;
  END IF;

  reward_payload := jsonb_build_object(
    'discount_type', 'fixed',
    'discount_value', voucher_currency_value,
    'max_discount_cap', NULL
  );

  INSERT INTO public.promotion_rewards (promotion_id, reward)
  VALUES (loyalty_promotion_id, reward_payload)
  ON CONFLICT (promotion_id)
  DO UPDATE SET reward = EXCLUDED.reward;

  voucher_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  INSERT INTO public.promotion_voucher_codes (
    promotion_id,
    code,
    max_uses_total,
    max_uses_per_customer
  ) VALUES (
    loyalty_promotion_id,
    voucher_code,
    1,
    1
  )
  RETURNING id INTO voucher_code_id;

  INSERT INTO public.loyalty_ledger (
    restaurant_id,
    customer_id,
    entry_type,
    points,
    currency_value,
    note
  ) VALUES (
    p_restaurant_id,
    p_customer_id,
    'spend',
    points_to_spend,
    voucher_currency_value,
    'Redeemed for loyalty voucher'
  );

  reward_title := format('£%s Voucher', trim(to_char(voucher_currency_value, 'FM999999990.##')));

  RETURN jsonb_build_object(
    'voucher_code_id', voucher_code_id,
    'code', voucher_code,
    'code_normalized', lower(voucher_code),
    'promotion_id', loyalty_promotion_id,
    'reward', reward_payload,
    'reward_title', reward_title,
    'points_spent', points_to_spend,
    'currency_value', voucher_currency_value
  );
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

  IF p_voucher_code IS NOT NULL THEN
    SELECT * INTO voucher_row
    FROM public.promotion_voucher_codes pvc
    WHERE pvc.promotion_id = promo_row.id
      AND pvc.code_normalized = lower(p_voucher_code)
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

  IF promo_row.type = 'basket_discount' THEN
    IF reward_payload IS NULL THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'missing_reward_payload', 'discount_amount', 0, 'delivery_discount_amount', 0);
    END IF;

    reward_discount_type := reward_payload->>'discount_type';
    reward_discount_value := NULLIF(reward_payload->>'discount_value', '')::numeric;
    reward_max_discount_cap := NULLIF(reward_payload->>'max_discount_cap', '')::numeric;

    IF reward_discount_type NOT IN ('percent', 'fixed') OR reward_discount_value IS NULL THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'invalid_reward_payload', 'discount_amount', 0, 'delivery_discount_amount', 0);
    END IF;

    IF reward_discount_type = 'percent' THEN
      discount_amount := GREATEST(0, p_basket_subtotal * reward_discount_value / 100.0);
    ELSE
      discount_amount := GREATEST(0, reward_discount_value);
    END IF;

    IF reward_max_discount_cap IS NOT NULL THEN
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
