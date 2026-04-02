ALTER TABLE IF EXISTS public.kiosk_payment_settings
  ADD COLUMN IF NOT EXISTS terminal_mode text NOT NULL DEFAULT 'real_tap_to_pay';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'kiosk_payment_settings_terminal_mode_check'
  ) THEN
    ALTER TABLE public.kiosk_payment_settings
      ADD CONSTRAINT kiosk_payment_settings_terminal_mode_check
      CHECK (terminal_mode IN ('real_tap_to_pay', 'simulated_terminal'));
  END IF;
END $$;

UPDATE public.kiosk_payment_settings
SET terminal_mode = 'real_tap_to_pay'
WHERE terminal_mode IS NULL OR terminal_mode NOT IN ('real_tap_to_pay', 'simulated_terminal');
