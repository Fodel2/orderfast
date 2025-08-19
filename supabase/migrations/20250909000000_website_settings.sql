-- Website settings: branding, pages, slides, contact
-- 1) Extend restaurants with website-specific fields
alter table if exists restaurants
  add column if not exists website_title text,
  add column if not exists website_description text,
  add column if not exists menu_description text,
  add column if not exists logo_url text,
  add column if not exists logo_shape text,
  add column if not exists cover_image_url text,
  add column if not exists brand_primary_color text,
  add column if not exists brand_secondary_color text,
  add column if not exists brand_color_extracted boolean default false,
  add column if not exists subdomain text,
  add column if not exists custom_domain text;

-- Normalize logo_shape values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'restaurants_logo_shape_check'
  ) THEN
    ALTER TABLE restaurants
      ADD CONSTRAINT restaurants_logo_shape_check
      CHECK (logo_shape IS NULL OR logo_shape IN ('square','round','rectangular'));
  END IF;
END$$;

-- Unique indexes for domains
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='restaurants_subdomain_key') THEN
    CREATE UNIQUE INDEX restaurants_subdomain_key ON restaurants (subdomain);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='restaurants_custom_domain_key') THEN
    CREATE UNIQUE INDEX restaurants_custom_domain_key ON restaurants (custom_domain);
  END IF;
END$$;

-- 2) Homepage slides table
CREATE TABLE IF NOT EXISTS website_homepage_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  key text,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS website_homepage_slides_restaurant_sort_idx
  ON website_homepage_slides (restaurant_id, enabled, sort_order);

-- 3) Custom pages table
CREATE TABLE IF NOT EXISTS website_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  seo_title text,
  seo_description text,
  cover_image_url text,
  sort_order integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='website_pages_restaurant_slug_key') THEN
    ALTER TABLE website_pages
      ADD CONSTRAINT website_pages_restaurant_slug_key UNIQUE (restaurant_id, slug);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS website_pages_pub_idx
  ON website_pages (restaurant_id, status);

-- 4) Website contact settings
CREATE TABLE IF NOT EXISTS website_contact_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  recipient_email text,
  fields jsonb NOT NULL DEFAULT '{"name":true,"phone":false,"message":true}'::jsonb,
  success_message text NOT NULL DEFAULT 'Thanks — we’ll get back to you shortly!',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5) Enable RLS and policies
ALTER TABLE website_homepage_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_contact_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='website_homepage_slides_select_public') THEN
    CREATE POLICY website_homepage_slides_select_public
      ON website_homepage_slides
      FOR SELECT
      TO anon, authenticated
      USING (enabled = true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='website_pages_select_published') THEN
    CREATE POLICY website_pages_select_published
      ON website_pages
      FOR SELECT
      TO anon, authenticated
      USING (status = 'published');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='website_contact_settings_select_public') THEN
    CREATE POLICY website_contact_settings_select_public
      ON website_contact_settings
      FOR SELECT
      TO anon, authenticated
      USING (enabled = true);
  END IF;
END$$;

-- Write policies (service role only)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='website_homepage_slides_write_svc') THEN
    CREATE POLICY website_homepage_slides_write_svc
      ON website_homepage_slides
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='website_pages_write_svc') THEN
    CREATE POLICY website_pages_write_svc
      ON website_pages
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname='website_contact_settings_write_svc') THEN
    CREATE POLICY website_contact_settings_write_svc
      ON website_contact_settings
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END$$;
