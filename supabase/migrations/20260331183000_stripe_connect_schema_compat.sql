-- Comprehensive compatibility migration for restaurant_stripe_connect_accounts.
-- Goal: support both legacy unprefixed and canonical stripe_* field names safely.

ALTER TABLE public.restaurant_stripe_connect_accounts
  ADD COLUMN IF NOT EXISTS onboarding_status text,
  ADD COLUMN IF NOT EXISTS charges_enabled boolean,
  ADD COLUMN IF NOT EXISTS payouts_enabled boolean,
  ADD COLUMN IF NOT EXISTS details_submitted boolean,
  ADD COLUMN IF NOT EXISTS requirements_currently_due jsonb,
  ADD COLUMN IF NOT EXISTS requirements_pending_verification jsonb,
  ADD COLUMN IF NOT EXISTS disabled_reason text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS terminal_location_id text,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_status text,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean,
  ADD COLUMN IF NOT EXISTS stripe_details_submitted boolean,
  ADD COLUMN IF NOT EXISTS stripe_requirements_currently_due jsonb,
  ADD COLUMN IF NOT EXISTS stripe_requirements_pending_verification jsonb,
  ADD COLUMN IF NOT EXISTS stripe_disabled_reason text,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_last_synced_at timestamptz;

UPDATE public.restaurant_stripe_connect_accounts
SET
  onboarding_status = COALESCE(onboarding_status, stripe_onboarding_status, 'not_connected'),
  stripe_onboarding_status = COALESCE(stripe_onboarding_status, onboarding_status, 'not_connected'),
  charges_enabled = COALESCE(charges_enabled, stripe_charges_enabled, false),
  stripe_charges_enabled = COALESCE(stripe_charges_enabled, charges_enabled, false),
  payouts_enabled = COALESCE(payouts_enabled, stripe_payouts_enabled, false),
  stripe_payouts_enabled = COALESCE(stripe_payouts_enabled, payouts_enabled, false),
  details_submitted = COALESCE(details_submitted, stripe_details_submitted, false),
  stripe_details_submitted = COALESCE(stripe_details_submitted, details_submitted, false),
  requirements_currently_due = COALESCE(requirements_currently_due, stripe_requirements_currently_due, '[]'::jsonb),
  stripe_requirements_currently_due = COALESCE(stripe_requirements_currently_due, requirements_currently_due, '[]'::jsonb),
  requirements_pending_verification = COALESCE(requirements_pending_verification, stripe_requirements_pending_verification, '[]'::jsonb),
  stripe_requirements_pending_verification = COALESCE(stripe_requirements_pending_verification, requirements_pending_verification, '[]'::jsonb),
  disabled_reason = COALESCE(disabled_reason, stripe_disabled_reason),
  stripe_disabled_reason = COALESCE(stripe_disabled_reason, disabled_reason),
  onboarding_completed_at = COALESCE(onboarding_completed_at, stripe_onboarding_completed_at),
  stripe_onboarding_completed_at = COALESCE(stripe_onboarding_completed_at, onboarding_completed_at),
  last_synced_at = COALESCE(last_synced_at, stripe_last_synced_at),
  stripe_last_synced_at = COALESCE(stripe_last_synced_at, last_synced_at),
  stripe_terminal_location_id = COALESCE(stripe_terminal_location_id, terminal_location_id),
  terminal_location_id = COALESCE(terminal_location_id, stripe_terminal_location_id);

ALTER TABLE public.restaurant_stripe_connect_accounts
  ALTER COLUMN onboarding_status SET DEFAULT 'not_connected',
  ALTER COLUMN stripe_onboarding_status SET DEFAULT 'not_connected',
  ALTER COLUMN charges_enabled SET DEFAULT false,
  ALTER COLUMN stripe_charges_enabled SET DEFAULT false,
  ALTER COLUMN payouts_enabled SET DEFAULT false,
  ALTER COLUMN stripe_payouts_enabled SET DEFAULT false,
  ALTER COLUMN details_submitted SET DEFAULT false,
  ALTER COLUMN stripe_details_submitted SET DEFAULT false,
  ALTER COLUMN requirements_currently_due SET DEFAULT '[]'::jsonb,
  ALTER COLUMN stripe_requirements_currently_due SET DEFAULT '[]'::jsonb,
  ALTER COLUMN requirements_pending_verification SET DEFAULT '[]'::jsonb,
  ALTER COLUMN stripe_requirements_pending_verification SET DEFAULT '[]'::jsonb;

ALTER TABLE public.restaurant_stripe_connect_accounts
  ALTER COLUMN onboarding_status SET NOT NULL,
  ALTER COLUMN stripe_onboarding_status SET NOT NULL,
  ALTER COLUMN charges_enabled SET NOT NULL,
  ALTER COLUMN stripe_charges_enabled SET NOT NULL,
  ALTER COLUMN payouts_enabled SET NOT NULL,
  ALTER COLUMN stripe_payouts_enabled SET NOT NULL,
  ALTER COLUMN details_submitted SET NOT NULL,
  ALTER COLUMN stripe_details_submitted SET NOT NULL,
  ALTER COLUMN requirements_currently_due SET NOT NULL,
  ALTER COLUMN stripe_requirements_currently_due SET NOT NULL,
  ALTER COLUMN requirements_pending_verification SET NOT NULL,
  ALTER COLUMN stripe_requirements_pending_verification SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'restaurant_stripe_connect_accounts_stripe_status_check'
      AND conrelid = 'public.restaurant_stripe_connect_accounts'::regclass
  ) THEN
    ALTER TABLE public.restaurant_stripe_connect_accounts
      ADD CONSTRAINT restaurant_stripe_connect_accounts_stripe_status_check CHECK (
        stripe_onboarding_status = ANY (
          ARRAY[
            'not_connected'::text,
            'setup_incomplete'::text,
            'under_review'::text,
            'restricted'::text,
            'connected'::text
          ]
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_restaurant_stripe_connect_account_compat()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.onboarding_status := COALESCE(NEW.onboarding_status, NEW.stripe_onboarding_status, 'not_connected');
  NEW.stripe_onboarding_status := COALESCE(NEW.stripe_onboarding_status, NEW.onboarding_status, 'not_connected');

  NEW.charges_enabled := COALESCE(NEW.charges_enabled, NEW.stripe_charges_enabled, false);
  NEW.stripe_charges_enabled := COALESCE(NEW.stripe_charges_enabled, NEW.charges_enabled, false);

  NEW.payouts_enabled := COALESCE(NEW.payouts_enabled, NEW.stripe_payouts_enabled, false);
  NEW.stripe_payouts_enabled := COALESCE(NEW.stripe_payouts_enabled, NEW.payouts_enabled, false);

  NEW.details_submitted := COALESCE(NEW.details_submitted, NEW.stripe_details_submitted, false);
  NEW.stripe_details_submitted := COALESCE(NEW.stripe_details_submitted, NEW.details_submitted, false);

  NEW.requirements_currently_due := COALESCE(NEW.requirements_currently_due, NEW.stripe_requirements_currently_due, '[]'::jsonb);
  NEW.stripe_requirements_currently_due := COALESCE(NEW.stripe_requirements_currently_due, NEW.requirements_currently_due, '[]'::jsonb);

  NEW.requirements_pending_verification := COALESCE(NEW.requirements_pending_verification, NEW.stripe_requirements_pending_verification, '[]'::jsonb);
  NEW.stripe_requirements_pending_verification := COALESCE(NEW.stripe_requirements_pending_verification, NEW.requirements_pending_verification, '[]'::jsonb);

  NEW.disabled_reason := COALESCE(NEW.disabled_reason, NEW.stripe_disabled_reason);
  NEW.stripe_disabled_reason := COALESCE(NEW.stripe_disabled_reason, NEW.disabled_reason);

  NEW.onboarding_completed_at := COALESCE(NEW.onboarding_completed_at, NEW.stripe_onboarding_completed_at);
  NEW.stripe_onboarding_completed_at := COALESCE(NEW.stripe_onboarding_completed_at, NEW.onboarding_completed_at);

  NEW.last_synced_at := COALESCE(NEW.last_synced_at, NEW.stripe_last_synced_at);
  NEW.stripe_last_synced_at := COALESCE(NEW.stripe_last_synced_at, NEW.last_synced_at);

  NEW.terminal_location_id := COALESCE(NEW.terminal_location_id, NEW.stripe_terminal_location_id);
  NEW.stripe_terminal_location_id := COALESCE(NEW.stripe_terminal_location_id, NEW.terminal_location_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restaurant_stripe_connect_accounts_compat
ON public.restaurant_stripe_connect_accounts;

CREATE TRIGGER trg_restaurant_stripe_connect_accounts_compat
BEFORE INSERT OR UPDATE ON public.restaurant_stripe_connect_accounts
FOR EACH ROW EXECUTE FUNCTION public.sync_restaurant_stripe_connect_account_compat();
