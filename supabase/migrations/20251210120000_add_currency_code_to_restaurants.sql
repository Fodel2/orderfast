ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'GBP';
