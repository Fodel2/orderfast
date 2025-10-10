import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { supaServer } from '@/lib/supaServer';

const VALID_URGENCY = new Set(['normal', 'urgent']);
const VALID_STATUS = new Set(['waiting', 'in-process', 'complete']);

type DashboardTask = {
  id: string;
  restaurant_id: string;
  title: string;
  urgency: 'normal' | 'urgent';
  status: 'waiting' | 'in-process' | 'complete';
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type ErrorResponse = { error: string };

type SuccessResponse =
  | { active: DashboardTask[]; archived: DashboardTask[] }
  | { task: DashboardTask };

async function ensureMembership(
  req: NextApiRequest,
  res: NextApiResponse,
  restaurantId: string,
  serviceSupabase = supaServer()
) {
  const userSupabase = createServerSupabaseClient({ req, res });
  const {
    data: { session },
  } = await userSupabase.auth.getSession();

  if (!session) {
    return { error: 'Unauthenticated', status: 401 } as const;
  }

  const { data: membership, error: membershipError } = await serviceSupabase
    .from('restaurant_users')
    .select('restaurant_id')
    .eq('restaurant_id', restaurantId)
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (membershipError) {
    return { error: membershipError.message, status: 500 } as const;
  }

  if (!membership) {
    // Check owner fallback
    const { data: restaurant, error: restaurantError } = await serviceSupabase
      .from('restaurants')
      .select('id, owner_id')
      .eq('id', restaurantId)
      .maybeSingle();

    if (restaurantError) {
      return { error: restaurantError.message, status: 500 } as const;
    }

    if (!restaurant || restaurant.owner_id !== session.user.id) {
      return { error: 'Forbidden', status: 403 } as const;
    }
  }

  return { session } as const;
}

function normalizeId(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function buildTaskUpdate(body: any) {
  const updates: Partial<DashboardTask> = {};
  if (typeof body?.updates?.title === 'string') {
    const trimmed = body.updates.title.trim();
    if (!trimmed) {
      return { error: 'Title cannot be empty' } as const;
    }
    updates.title = trimmed;
  }

  if (typeof body?.updates?.urgency === 'string') {
    if (!VALID_URGENCY.has(body.updates.urgency)) {
      return { error: 'Invalid urgency' } as const;
    }
    updates.urgency = body.updates.urgency;
  }

  if (typeof body?.updates?.status === 'string') {
    if (!VALID_STATUS.has(body.updates.status)) {
      return { error: 'Invalid status' } as const;
    }
    updates.status = body.updates.status;
  }

  const archiveFlag = body?.archive;
  if (archiveFlag === true) {
    updates.archived_at = new Date().toISOString();
    if (!updates.status) {
      updates.status = 'complete';
    }
  } else if (archiveFlag === false) {
    updates.archived_at = null;
  }

  if (Object.keys(updates).length === 0) {
    return { error: 'No updates provided' } as const;
  }

  updates.updated_at = new Date().toISOString();
  return { updates } as const;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  const restaurantId =
    req.method === 'GET'
      ? normalizeId(req.query.restaurantId)
      : normalizeId((req.body && req.body.restaurantId) || undefined);

  if (!restaurantId) {
    return res.status(400).json({ error: 'restaurantId is required' });
  }

  const serviceSupabase = supaServer();
  const membership = await ensureMembership(req, res, restaurantId, serviceSupabase);
  if ('error' in membership) {
    return res.status(membership.status).json({ error: membership.error });
  }

  if (req.method === 'GET') {
    const { data, error } = await serviceSupabase
      .from('dashboard_tasks')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('updated_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const active = (data || []).filter((task) => !task.archived_at);
    const archived = (data || []).filter((task) => task.archived_at);
    return res.status(200).json({ active, archived });
  }

  if (req.method === 'POST') {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const urgency = typeof req.body?.urgency === 'string' ? req.body.urgency : 'normal';
    const status = typeof req.body?.status === 'string' ? req.body.status : 'waiting';

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!VALID_URGENCY.has(urgency)) {
      return res.status(400).json({ error: 'Invalid urgency' });
    }

    if (!VALID_STATUS.has(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const now = new Date().toISOString();
    const { data, error } = await serviceSupabase
      .from('dashboard_tasks')
      .insert({
        restaurant_id: restaurantId,
        title,
        urgency,
        status,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error || !data) {
      return res.status(500).json({ error: error?.message || 'Failed to create task' });
    }

    return res.status(201).json({ task: data });
  }

  if (req.method === 'PATCH') {
    const id = normalizeId(req.body?.id);
    if (!id) {
      return res.status(400).json({ error: 'Task id is required' });
    }

    const built = buildTaskUpdate(req.body);
    if ('error' in built) {
      return res.status(400).json({ error: built.error });
    }

    const { updates } = built;
    const { data, error } = await serviceSupabase
      .from('dashboard_tasks')
      .update(updates)
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.status(200).json({ task: data });
  }

  res.setHeader('Allow', 'GET,POST,PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}
