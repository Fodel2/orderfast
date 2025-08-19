ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS brand_primary_color text,
  ADD COLUMN IF NOT EXISTS brand_secondary_color text,
  ADD COLUMN IF NOT EXISTS brand_color_extracted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS website_title text,
  ADD COLUMN IF NOT EXISTS menu_description text,
  ADD COLUMN IF NOT EXISTS logo_shape text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='restaurants_logo_shape_check'
  ) THEN
    ALTER TABLE public.restaurants
      ADD CONSTRAINT restaurants_logo_shape_check
      CHECK (logo_shape IS NULL OR logo_shape IN ('square','round','rectangular'));
  END IF;
END$$;
