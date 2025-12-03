-- Add auto-accept settings to restaurants
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS auto_accept_kiosk_orders boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_accept_app_orders boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_accept_pos_orders boolean NOT NULL DEFAULT false;

-- Track when orders are accepted
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
