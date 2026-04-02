ALTER TABLE IF EXISTS public.kiosk_card_present_sessions
  ALTER COLUMN stripe_connected_account_id DROP NOT NULL,
  ALTER COLUMN stripe_terminal_location_id DROP NOT NULL;
