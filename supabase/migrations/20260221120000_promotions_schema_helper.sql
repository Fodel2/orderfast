-- Helper utilities for promotions schema diagnostics and manual install in environments
-- where migrations were not yet applied to the connected Supabase project.

CREATE OR REPLACE FUNCTION public.promotions_schema_health_check()
RETURNS TABLE (
  promotions_exists regclass,
  promotion_rewards_exists regclass,
  promotion_voucher_codes_exists regclass,
  restaurant_promo_terms_exists regclass,
  promotion_redemptions_exists regclass,
  loyalty_config_exists regclass,
  loyalty_ledger_exists regclass
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    to_regclass('public.promotions'),
    to_regclass('public.promotion_rewards'),
    to_regclass('public.promotion_voucher_codes'),
    to_regclass('public.restaurant_promo_terms'),
    to_regclass('public.promotion_redemptions'),
    to_regclass('public.loyalty_config'),
    to_regclass('public.loyalty_ledger');
$$;

CREATE OR REPLACE FUNCTION public.install_promotions_loyalty_schema_if_missing()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
    days_of_week integer[],
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

  CREATE TABLE IF NOT EXISTS public.promotion_rewards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id uuid NOT NULL UNIQUE REFERENCES public.promotions(id) ON DELETE CASCADE,
    reward jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );

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

  CREATE INDEX IF NOT EXISTS promotions_restaurant_id_idx
    ON public.promotions (restaurant_id);
  CREATE INDEX IF NOT EXISTS promotions_restaurant_status_priority_idx
    ON public.promotions (restaurant_id, status, priority, starts_at);
  CREATE INDEX IF NOT EXISTS promotion_voucher_codes_promotion_id_idx
    ON public.promotion_voucher_codes (promotion_id);
  CREATE INDEX IF NOT EXISTS promotion_redemptions_restaurant_id_idx
    ON public.promotion_redemptions (restaurant_id);
  CREATE INDEX IF NOT EXISTS promotion_redemptions_promotion_id_idx
    ON public.promotion_redemptions (promotion_id);
  CREATE INDEX IF NOT EXISTS promotion_redemptions_customer_id_idx
    ON public.promotion_redemptions (customer_id);
  CREATE INDEX IF NOT EXISTS promotion_redemptions_created_at_idx
    ON public.promotion_redemptions (created_at);
  CREATE INDEX IF NOT EXISTS loyalty_ledger_restaurant_customer_created_idx
    ON public.loyalty_ledger (restaurant_id, customer_id, created_at);

  NOTIFY pgrst, 'reload schema';
END;
$$;

-- Manual run (from Supabase SQL editor) when schema is missing in the connected project:
-- SELECT public.install_promotions_loyalty_schema_if_missing();
