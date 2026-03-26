import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { supaServer } from '@/lib/supaServer';

const DEFAULT_CONTACT_SETTINGS = {
  enabled: true,
  recipient_email: '',
  fields: {
    name: true,
    phone: false,
    email: false,
    message: true,
  },
};

const toBoolean = (value: unknown) => value === true;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const supabaseAuth = createServerSupabaseClient({ req, res });
  const {
    data: { session },
  } = await supabaseAuth.auth.getSession();

  if (!session?.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { data: membership, error: membershipError } = await supaServer
    .from('restaurant_users')
    .select('restaurant_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (membershipError || !membership?.restaurant_id) {
    return res.status(403).json({ message: 'Restaurant context unavailable' });
  }

  const restaurantId = String(membership.restaurant_id);

  if (req.method === 'GET') {
    const { data, error } = await supaServer
      .from('website_contact_settings')
      .select('enabled, recipient_email, fields')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    const fields = data?.fields || {};
    return res.status(200).json({
      enabled: data?.enabled ?? DEFAULT_CONTACT_SETTINGS.enabled,
      recipient_email: data?.recipient_email || DEFAULT_CONTACT_SETTINGS.recipient_email,
      fields: {
        name: toBoolean(fields.name) || DEFAULT_CONTACT_SETTINGS.fields.name,
        phone: toBoolean(fields.phone),
        email: toBoolean(fields.email),
        message: true,
      },
    });
  }

  const enabled = req.body?.enabled !== false;
  const recipientEmail = String(req.body?.recipient_email || '').trim();
  const bodyFields = req.body?.fields || {};

  const fields = {
    name: toBoolean(bodyFields.name),
    phone: toBoolean(bodyFields.phone),
    email: toBoolean(bodyFields.email),
    message: true,
  };

  const { data, error } = await supaServer
    .from('website_contact_settings')
    .upsert(
      {
        restaurant_id: restaurantId,
        enabled,
        recipient_email: recipientEmail || null,
        fields,
      },
      { onConflict: 'restaurant_id' }
    )
    .select('enabled, recipient_email, fields')
    .single();

  if (error) {
    return res.status(500).json({ message: error.message });
  }

  return res.status(200).json(data);
}
