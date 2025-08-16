ALTER TABLE public.menu_builder_drafts ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
UPDATE public.menu_builder_drafts SET id = uuid_generate_v4() WHERE id IS NULL;
ALTER TABLE public.menu_builder_drafts DROP CONSTRAINT IF EXISTS menu_builder_drafts_pkey;
ALTER TABLE public.menu_builder_drafts ADD CONSTRAINT menu_builder_drafts_pkey PRIMARY KEY (id);
ALTER TABLE public.menu_builder_drafts ADD CONSTRAINT menu_builder_drafts_restaurant_id_key UNIQUE (restaurant_id);
DROP POLICY IF EXISTS "menu_builder_drafts_all" ON public.menu_builder_drafts;
