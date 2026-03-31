-- Extend restaurant Stripe Connect mapping with Terminal readiness metadata

ALTER TABLE public.restaurant_stripe_connect_accounts
  ADD COLUMN IF NOT EXISTS stripe_terminal_location_id text,
  ADD COLUMN IF NOT EXISTS stripe_terminal_location_display_name text,
  ADD COLUMN IF NOT EXISTS terminal_readiness_status text NOT NULL DEFAULT 'terminal_not_configured',
  ADD COLUMN IF NOT EXISTS terminal_readiness_reason text,
  ADD COLUMN IF NOT EXISTS terminal_last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS terminal_last_synced_at timestamptz;

UPDATE public.restaurant_stripe_connect_accounts
SET stripe_terminal_location_id = COALESCE(stripe_terminal_location_id, terminal_location_id)
WHERE stripe_terminal_location_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_stripe_connect_accounts_terminal_readiness_status_check'
      AND conrelid = 'public.restaurant_stripe_connect_accounts'::regclass
  ) THEN
    ALTER TABLE public.restaurant_stripe_connect_accounts
      ADD CONSTRAINT restaurant_stripe_connect_accounts_terminal_readiness_status_check CHECK (
        terminal_readiness_status = ANY (
          ARRAY[
            'not_connected'::text,
            'stripe_setup_incomplete'::text,
            'terminal_not_configured'::text,
            'terminal_pending'::text,
            'tap_to_pay_ready'::text,
            'temporarily_unavailable'::text
          ]
        )
      );
  END IF;
END $$;

UPDATE public.restaurant_stripe_connect_accounts
SET
  terminal_readiness_status = CASE
    WHEN stripe_connected_account_id IS NULL THEN 'not_connected'
    WHEN onboarding_status IN ('setup_incomplete', 'under_review') THEN 'stripe_setup_incomplete'
    WHEN onboarding_status = 'restricted' THEN 'temporarily_unavailable'
    WHEN stripe_terminal_location_id IS NULL THEN 'terminal_not_configured'
    ELSE 'terminal_pending'
  END,
  terminal_readiness_reason = CASE
    WHEN stripe_connected_account_id IS NULL THEN 'Connect Stripe to prepare Tap to Pay.'
    WHEN onboarding_status IN ('setup_incomplete', 'under_review') THEN 'Finish Stripe setup before Tap to Pay can be enabled.'
    WHEN onboarding_status = 'restricted' THEN 'Stripe has temporarily restricted this account.'
    WHEN stripe_terminal_location_id IS NULL THEN 'Prepare a terminal location to enable Tap to Pay setup.'
    ELSE 'Terminal setup is in progress.'
  END,
  terminal_last_checked_at = COALESCE(terminal_last_checked_at, now())
WHERE terminal_readiness_status IS NULL OR terminal_readiness_status = '';
