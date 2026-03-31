-- Restaurant-level Stripe Connect mapping for multi-tenant payment routing groundwork

CREATE TABLE IF NOT EXISTS public.restaurant_stripe_connect_accounts (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  stripe_connected_account_id text UNIQUE,
  onboarding_status text NOT NULL DEFAULT 'not_connected',
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  requirements_currently_due jsonb NOT NULL DEFAULT '[]'::jsonb,
  requirements_pending_verification jsonb NOT NULL DEFAULT '[]'::jsonb,
  disabled_reason text,
  terminal_location_id text,
  onboarding_completed_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_stripe_connect_accounts_status_check CHECK (
    onboarding_status = ANY (
      ARRAY[
        'not_connected'::text,
        'setup_incomplete'::text,
        'under_review'::text,
        'restricted'::text,
        'connected'::text
      ]
    )
  )
);

DROP TRIGGER IF EXISTS trg_restaurant_stripe_connect_accounts_updated_at ON public.restaurant_stripe_connect_accounts;
CREATE TRIGGER trg_restaurant_stripe_connect_accounts_updated_at
BEFORE UPDATE ON public.restaurant_stripe_connect_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.restaurant_stripe_connect_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage restaurant Stripe connect" ON public.restaurant_stripe_connect_accounts;
CREATE POLICY "Owners manage restaurant Stripe connect"
ON public.restaurant_stripe_connect_accounts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = restaurant_stripe_connect_accounts.restaurant_id
      AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = restaurant_stripe_connect_accounts.restaurant_id
      AND r.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Staff manage restaurant Stripe connect" ON public.restaurant_stripe_connect_accounts;
CREATE POLICY "Staff manage restaurant Stripe connect"
ON public.restaurant_stripe_connect_accounts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurant_users ru
    WHERE ru.restaurant_id = restaurant_stripe_connect_accounts.restaurant_id
      AND ru.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurant_users ru
    WHERE ru.restaurant_id = restaurant_stripe_connect_accounts.restaurant_id
      AND ru.user_id = auth.uid()
  )
);
