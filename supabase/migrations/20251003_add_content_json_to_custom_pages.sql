ALTER TABLE public.custom_pages
ADD COLUMN IF NOT EXISTS content_json jsonb DEFAULT '[]'::jsonb; -- array of blocks

-- minor helper index
CREATE INDEX IF NOT EXISTS idx_custom_pages_content_json ON public.custom_pages USING GIN (content_json);

-- (RLS policies remain as previously created)
