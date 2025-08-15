CREATE TABLE IF NOT EXISTS public.menu_builder_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS menu_builder_drafts_restaurant_id_uidx
  ON public.menu_builder_drafts(restaurant_id);
