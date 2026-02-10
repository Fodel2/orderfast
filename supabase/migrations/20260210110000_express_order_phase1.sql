-- Express Order Phase 1

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.express_order_settings (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  enable_takeaway boolean NOT NULL DEFAULT true,
  enable_dine_in boolean NOT NULL DEFAULT true,
  takeaway_payment_mode text NOT NULL DEFAULT 'card_only' CHECK (takeaway_payment_mode IN ('card_only')),
  dine_in_payment_mode text NOT NULL DEFAULT 'immediate_pay' CHECK (dine_in_payment_mode IN ('immediate_pay','open_tab')),
  dine_in_security_mode text NOT NULL DEFAULT 'none' CHECK (dine_in_security_mode IN ('none','table_code')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_express_order_settings_updated_at ON public.express_order_settings;
CREATE TRIGGER trg_express_order_settings_updated_at
BEFORE UPDATE ON public.express_order_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_number integer NOT NULL,
  table_name text,
  enabled boolean NOT NULL DEFAULT true,
  table_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_tables_restaurant_table_number_key'
  ) THEN
    ALTER TABLE public.restaurant_tables
      ADD CONSTRAINT restaurant_tables_restaurant_table_number_key UNIQUE (restaurant_id, table_number);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS restaurant_tables_restaurant_enabled_idx
  ON public.restaurant_tables (restaurant_id, enabled, table_number);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS dine_in_table_number integer;

ALTER TABLE public.express_order_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage express settings" ON public.express_order_settings;
CREATE POLICY "Owners manage express settings"
ON public.express_order_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = express_order_settings.restaurant_id
      AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = express_order_settings.restaurant_id
      AND r.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Staff manage express settings" ON public.express_order_settings;
CREATE POLICY "Staff manage express settings"
ON public.express_order_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurant_users ru
    WHERE ru.restaurant_id = express_order_settings.restaurant_id
      AND ru.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurant_users ru
    WHERE ru.restaurant_id = express_order_settings.restaurant_id
      AND ru.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners manage restaurant tables" ON public.restaurant_tables;
CREATE POLICY "Owners manage restaurant tables"
ON public.restaurant_tables
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = restaurant_tables.restaurant_id
      AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = restaurant_tables.restaurant_id
      AND r.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Staff manage restaurant tables" ON public.restaurant_tables;
CREATE POLICY "Staff manage restaurant tables"
ON public.restaurant_tables
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurant_users ru
    WHERE ru.restaurant_id = restaurant_tables.restaurant_id
      AND ru.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurant_users ru
    WHERE ru.restaurant_id = restaurant_tables.restaurant_id
      AND ru.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Public read enabled restaurant tables" ON public.restaurant_tables;
CREATE POLICY "Public read enabled restaurant tables"
ON public.restaurant_tables
FOR SELECT
TO anon, authenticated
USING (enabled = true);
