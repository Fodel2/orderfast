-- Kiosk payment method configuration groundwork

CREATE TABLE IF NOT EXISTS public.kiosk_payment_settings (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  process_on_device boolean NOT NULL DEFAULT false,
  enable_cash boolean NOT NULL DEFAULT false,
  enable_contactless boolean NOT NULL DEFAULT false,
  enable_pay_at_counter boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_kiosk_payment_settings_updated_at ON public.kiosk_payment_settings;
CREATE TRIGGER trg_kiosk_payment_settings_updated_at
BEFORE UPDATE ON public.kiosk_payment_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.kiosk_payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage kiosk payment settings" ON public.kiosk_payment_settings;
CREATE POLICY "Owners manage kiosk payment settings"
ON public.kiosk_payment_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = kiosk_payment_settings.restaurant_id
      AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = kiosk_payment_settings.restaurant_id
      AND r.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Staff manage kiosk payment settings" ON public.kiosk_payment_settings;
CREATE POLICY "Staff manage kiosk payment settings"
ON public.kiosk_payment_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurant_users ru
    WHERE ru.restaurant_id = kiosk_payment_settings.restaurant_id
      AND ru.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurant_users ru
    WHERE ru.restaurant_id = kiosk_payment_settings.restaurant_id
      AND ru.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Public read kiosk payment settings" ON public.kiosk_payment_settings;
CREATE POLICY "Public read kiosk payment settings"
ON public.kiosk_payment_settings
FOR SELECT
TO anon, authenticated
USING (true);
