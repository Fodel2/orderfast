-- ensure updated_at works
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_custom_pages_updated_at ON public.custom_pages;
CREATE TRIGGER trg_custom_pages_updated_at
BEFORE UPDATE ON public.custom_pages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- indexes
CREATE INDEX IF NOT EXISTS idx_custom_pages_restaurant_id ON public.custom_pages(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_custom_pages_sort ON public.custom_pages(restaurant_id, sort_order);

-- enable RLS
ALTER TABLE public.custom_pages ENABLE ROW LEVEL SECURITY;

-- public read (customer site)
DROP POLICY IF EXISTS "Public read custom pages" ON public.custom_pages;
CREATE POLICY "Public read custom pages"
ON public.custom_pages
FOR SELECT
TO anon, authenticated
USING (true);

-- owners manage
DROP POLICY IF EXISTS "Owners manage custom pages" ON public.custom_pages;
CREATE POLICY "Owners manage custom pages"
ON public.custom_pages
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.restaurants r
  WHERE r.id = custom_pages.restaurant_id
    AND r.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.restaurants r
  WHERE r.id = custom_pages.restaurant_id
    AND r.owner_id = auth.uid()
));

-- restaurant users manage
DROP POLICY IF EXISTS "Staff manage custom pages" ON public.custom_pages;
CREATE POLICY "Staff manage custom pages"
ON public.custom_pages
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.restaurant_users ru
  WHERE ru.restaurant_id = custom_pages.restaurant_id
    AND ru.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.restaurant_users ru
  WHERE ru.restaurant_id = custom_pages.restaurant_id
    AND ru.user_id = auth.uid()
));

--------------------------------------------------------------------------------
-- If you later want per-restaurant slugs, replace UNIQUE(slug) with UNIQUE(restaurant_id, slug)
--------------------------------------------------------------------------------
