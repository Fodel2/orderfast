ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS cover_image_url text;
