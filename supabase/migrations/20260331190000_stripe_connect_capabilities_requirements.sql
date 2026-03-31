-- Add capability + requirements detail columns used by Stripe Connect readiness sync.

ALTER TABLE public.restaurant_stripe_connect_accounts
  ADD COLUMN IF NOT EXISTS card_payments_capability text,
  ADD COLUMN IF NOT EXISTS stripe_card_payments_capability text,
  ADD COLUMN IF NOT EXISTS transfers_capability text,
  ADD COLUMN IF NOT EXISTS stripe_transfers_capability text,
  ADD COLUMN IF NOT EXISTS requirements_eventually_due jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS stripe_requirements_eventually_due jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS requirements_past_due jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS stripe_requirements_past_due jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.restaurant_stripe_connect_accounts
SET
  card_payments_capability = COALESCE(card_payments_capability, stripe_card_payments_capability),
  stripe_card_payments_capability = COALESCE(stripe_card_payments_capability, card_payments_capability),
  transfers_capability = COALESCE(transfers_capability, stripe_transfers_capability),
  stripe_transfers_capability = COALESCE(stripe_transfers_capability, transfers_capability),
  requirements_eventually_due = COALESCE(requirements_eventually_due, stripe_requirements_eventually_due, '[]'::jsonb),
  stripe_requirements_eventually_due = COALESCE(stripe_requirements_eventually_due, requirements_eventually_due, '[]'::jsonb),
  requirements_past_due = COALESCE(requirements_past_due, stripe_requirements_past_due, '[]'::jsonb),
  stripe_requirements_past_due = COALESCE(stripe_requirements_past_due, requirements_past_due, '[]'::jsonb);

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

  NEW.card_payments_capability := COALESCE(NEW.card_payments_capability, NEW.stripe_card_payments_capability);
  NEW.stripe_card_payments_capability := COALESCE(NEW.stripe_card_payments_capability, NEW.card_payments_capability);

  NEW.transfers_capability := COALESCE(NEW.transfers_capability, NEW.stripe_transfers_capability);
  NEW.stripe_transfers_capability := COALESCE(NEW.stripe_transfers_capability, NEW.transfers_capability);

  NEW.requirements_currently_due := COALESCE(NEW.requirements_currently_due, NEW.stripe_requirements_currently_due, '[]'::jsonb);
  NEW.stripe_requirements_currently_due := COALESCE(NEW.stripe_requirements_currently_due, NEW.requirements_currently_due, '[]'::jsonb);

  NEW.requirements_eventually_due := COALESCE(NEW.requirements_eventually_due, NEW.stripe_requirements_eventually_due, '[]'::jsonb);
  NEW.stripe_requirements_eventually_due := COALESCE(NEW.stripe_requirements_eventually_due, NEW.requirements_eventually_due, '[]'::jsonb);

  NEW.requirements_past_due := COALESCE(NEW.requirements_past_due, NEW.stripe_requirements_past_due, '[]'::jsonb);
  NEW.stripe_requirements_past_due := COALESCE(NEW.stripe_requirements_past_due, NEW.requirements_past_due, '[]'::jsonb);

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
