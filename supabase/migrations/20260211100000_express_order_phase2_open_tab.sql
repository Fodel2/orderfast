-- Express Order Phase 2: dine-in open tabs + table sessions

CREATE TABLE IF NOT EXISTS public.table_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_number integer NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opened_by uuid REFERENCES auth.users(id),
  closed_by uuid REFERENCES auth.users(id),
  notes text
);

CREATE UNIQUE INDEX IF NOT EXISTS table_sessions_one_open_per_table_idx
  ON public.table_sessions (restaurant_id, table_number)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS table_sessions_restaurant_status_idx
  ON public.table_sessions (restaurant_id, status, opened_at DESC);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS table_session_id uuid REFERENCES public.table_sessions(id);

CREATE INDEX IF NOT EXISTS orders_table_session_id_idx
  ON public.orders (table_session_id);

ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage table sessions" ON public.table_sessions;
CREATE POLICY "Owners manage table sessions"
ON public.table_sessions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = table_sessions.restaurant_id
      AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = table_sessions.restaurant_id
      AND r.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Staff manage table sessions" ON public.table_sessions;
CREATE POLICY "Staff manage table sessions"
ON public.table_sessions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.restaurant_users ru
    WHERE ru.restaurant_id = table_sessions.restaurant_id
      AND ru.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.restaurant_users ru
    WHERE ru.restaurant_id = table_sessions.restaurant_id
      AND ru.user_id = auth.uid()
  )
);

-- Do not expose table codes publicly.
DROP POLICY IF EXISTS "Public read enabled restaurant tables" ON public.restaurant_tables;

CREATE OR REPLACE FUNCTION public.ensure_open_table_session(
  p_restaurant_id uuid,
  p_table_number integer,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id uuid;
BEGIN
  SELECT id
  INTO existing_id
  FROM public.table_sessions
  WHERE restaurant_id = p_restaurant_id
    AND table_number = p_table_number
    AND status = 'open'
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  INSERT INTO public.table_sessions (restaurant_id, table_number, status, opened_by, notes)
  VALUES (p_restaurant_id, p_table_number, 'open', auth.uid(), p_notes)
  RETURNING id INTO existing_id;

  RETURN existing_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_table_code(
  p_restaurant_id uuid,
  p_table_number integer,
  p_entered_code text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_tables rt
    WHERE rt.restaurant_id = p_restaurant_id
      AND rt.table_number = p_table_number
      AND rt.enabled = true
      AND rt.table_code IS NOT NULL
      AND upper(rt.table_code) = upper(trim(coalesce(p_entered_code, '')))
  );
$$;

GRANT EXECUTE ON FUNCTION public.ensure_open_table_session(uuid, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_table_code(uuid, integer, text) TO anon, authenticated;
