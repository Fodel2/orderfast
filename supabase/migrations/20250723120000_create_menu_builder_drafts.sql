CREATE TABLE IF NOT EXISTS public.menu_builder_drafts (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_builder_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_builder_drafts_all"
  ON public.menu_builder_drafts FOR ALL
  USING (true)
  WITH CHECK (true);

