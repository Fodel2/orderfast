import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerAvailabilitySnapshot } from '@/lib/server/availability';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const restaurantId = typeof req.body?.restaurantId === 'string' ? req.body.restaurantId.trim() : '';
  if (!restaurantId) {
    return res.status(400).json({ error: 'Missing restaurantId' });
  }

  const result = await getServerAvailabilitySnapshot(restaurantId);
  if (!result.ok) {
    return res.status(500).json({ error: 'reason' in result ? result.reason : 'Availability check failed' });
  }

  if (!result.snapshot.blocksNewSessions) {
    return res.status(200).json({ open: true, snapshot: result.snapshot });
  }

  return res.status(409).json({ open: false, snapshot: result.snapshot });
}
