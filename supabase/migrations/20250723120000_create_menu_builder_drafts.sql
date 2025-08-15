CREATE TABLE IF NOT EXISTS public.menu_builder_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS menu_builder_drafts_user_restaurant_uidx
  ON public.menu_builder_drafts(user_id, restaurant_id);

ALTER TABLE public.menu_builder_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_builder_drafts_user"
  ON public.menu_builder_drafts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "menu_builder_drafts_insert"
  ON public.menu_builder_drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "menu_builder_drafts_update"
  ON public.menu_builder_drafts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
