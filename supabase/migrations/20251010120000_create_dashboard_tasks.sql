-- Dashboard task logger storage
CREATE TABLE IF NOT EXISTS public.dashboard_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  title text NOT NULL,
  urgency text NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent')),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in-process', 'complete')),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_restaurant ON public.dashboard_tasks(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_active ON public.dashboard_tasks(restaurant_id, archived_at, status);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_dashboard_tasks_updated_at ON public.dashboard_tasks;
CREATE TRIGGER trg_dashboard_tasks_updated_at
BEFORE UPDATE ON public.dashboard_tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.dashboard_tasks ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'dashboard_tasks_service_manage'
  ) THEN
    CREATE POLICY dashboard_tasks_service_manage
      ON public.dashboard_tasks
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END$$;

-- Allow restaurant owners and staff to manage their tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'dashboard_tasks_staff_select'
  ) THEN
    CREATE POLICY dashboard_tasks_staff_select
      ON public.dashboard_tasks
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.restaurants r
          WHERE r.id = dashboard_tasks.restaurant_id
            AND (r.owner_id = auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM public.restaurant_users ru
          WHERE ru.restaurant_id = dashboard_tasks.restaurant_id
            AND ru.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'dashboard_tasks_staff_manage'
  ) THEN
    CREATE POLICY dashboard_tasks_staff_manage
      ON public.dashboard_tasks
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.restaurants r
          WHERE r.id = dashboard_tasks.restaurant_id
            AND (r.owner_id = auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM public.restaurant_users ru
          WHERE ru.restaurant_id = dashboard_tasks.restaurant_id
            AND ru.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.restaurants r
          WHERE r.id = dashboard_tasks.restaurant_id
            AND (r.owner_id = auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM public.restaurant_users ru
          WHERE ru.restaurant_id = dashboard_tasks.restaurant_id
            AND ru.user_id = auth.uid()
        )
      );
  END IF;
END$$;
