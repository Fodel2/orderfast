import { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const supabase = createServerSupabaseClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  const { name, address } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const { data: existing } = await supabase
    .from('restaurant_users')
    .select('id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (existing) {
    return res.status(400).json({ error: 'Already assigned to a restaurant' });
  }

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .insert({ name, address })
    .select()
    .single();

  if (error || !restaurant) {
    return res.status(500).json({ error: error?.message || 'Failed to create restaurant' });
  }

  const { error: linkError } = await supabase
    .from('restaurant_users')
    .insert({ restaurant_id: restaurant.id, user_id: session.user.id, role: 'owner' });

  if (linkError) {
    return res.status(500).json({ error: linkError.message });
  }

  return res.status(200).json({ restaurant });
}
