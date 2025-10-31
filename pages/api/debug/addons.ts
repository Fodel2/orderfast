import type { NextApiRequest, NextApiResponse } from 'next';
import { supaServer } from '@/lib/supaServer';

type ColumnCheck = { table: string; column: string };

type ColumnStatus = Record<string, { exists: boolean; error?: string | null }>;

const REQUIRED_COLUMNS: ColumnCheck[] = [
  { table: 'addon_groups', column: 'archived_at' },
  { table: 'addon_options', column: 'archived_at' },
  { table: 'addon_groups_drafts', column: 'restaurant_id' },
  { table: 'addon_groups_drafts', column: 'archived_at' },
  { table: 'addon_groups_drafts', column: 'state' },
  { table: 'addon_options_drafts', column: 'restaurant_id' },
  { table: 'addon_options_drafts', column: 'archived_at' },
  { table: 'addon_options_drafts', column: 'state' },
  { table: 'item_addon_links_drafts', column: 'item_external_key' },
  { table: 'item_addon_links_drafts', column: 'state' },
];

function getRestaurantId(req: NextApiRequest): string | undefined {
  const fromQuery = (req.query.restaurantId || req.query.restaurant_id || req.query.rid) as
    | string
    | string[]
    | undefined;
  if (typeof fromQuery === 'string' && fromQuery) return fromQuery;
  if (Array.isArray(fromQuery) && fromQuery.length > 0) return fromQuery[0];
  if (req.method !== 'GET') {
    const body = req.body as { restaurantId?: string } | undefined;
    if (body?.restaurantId) return body.restaurantId;
  }
  if (process.env.NODE_ENV !== 'production') {
    return process.env.NEXT_PUBLIC_DEMO_RESTAURANT_ID;
  }
  return undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ message: 'debug endpoint disabled in production' });
  }

  const restaurantId = getRestaurantId(req);
  if (!restaurantId) {
    return res.status(400).json({ message: 'restaurantId is required' });
  }

  try {
    const columnStatus: ColumnStatus = {};
    for (const check of REQUIRED_COLUMNS) {
      const key = `${check.table}.${check.column}`;
      const { error } = await supaServer
        .from(check.table)
        .select(check.column)
        .eq('restaurant_id', restaurantId)
        .limit(1);
      if (error && error.code === '42703') {
        columnStatus[key] = { exists: false, error: error.message };
      } else if (error) {
        columnStatus[key] = { exists: false, error: error.message };
      } else {
        columnStatus[key] = { exists: true };
      }
    }

    const [
      liveGroups,
      draftGroups,
      draftOptions,
      draftLinks,
      liveLinks,
    ] = await Promise.all([
      supaServer
        .from('addon_groups')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .is('archived_at', null),
      supaServer
        .from('addon_groups_drafts')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .is('archived_at', null)
        .eq('state', 'draft'),
      supaServer
        .from('addon_options_drafts')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .is('archived_at', null)
        .eq('state', 'draft'),
      supaServer
        .from('item_addon_links_drafts')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId),
      supaServer
        .from('item_addon_links')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId),
    ]);

    if (liveGroups.error) throw Object.assign(liveGroups.error, { where: 'live_groups' });
    if (draftGroups.error) throw Object.assign(draftGroups.error, { where: 'draft_groups' });
    if (draftOptions.error) throw Object.assign(draftOptions.error, { where: 'draft_options' });
    if (draftLinks.error) throw Object.assign(draftLinks.error, { where: 'draft_links' });
    if (liveLinks.error) throw Object.assign(liveLinks.error, { where: 'live_links' });

    const seedPreview = await supaServer
      .rpc('seed_addon_drafts', { p_restaurant_id: restaurantId })
      .select();
    const seedRow = Array.isArray(seedPreview.data) ? seedPreview.data[0] : seedPreview.data;

    const draftLinkSample = await supaServer
      .from('item_addon_links_drafts')
      .select('item_external_key,group_id')
      .eq('restaurant_id', restaurantId)
      .limit(5);
    if (draftLinkSample.error) {
      throw Object.assign(draftLinkSample.error, { where: 'draft_link_sample' });
    }

    return res.status(200).json({
      restaurantId,
      columnStatus,
      counts: {
        live: {
          groups: liveGroups.count ?? 0,
          links: liveLinks.count ?? 0,
        },
        drafts: {
          groups: draftGroups.count ?? 0,
          options: draftOptions.count ?? 0,
          links: draftLinks.count ?? 0,
        },
      },
      seedPreview: seedRow || null,
      publishPreview: {
        groups: draftGroups.count ?? 0,
        options: draftOptions.count ?? 0,
        links: draftLinks.count ?? 0,
      },
      sampleDraftLinks: draftLinkSample.data || [],
    });
  } catch (error: any) {
    console.error('[debug:addons]', {
      restaurantId,
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      stack: error?.stack,
      where: error?.where,
    });
    return res.status(500).json({
      message: error?.message || 'debug_failed',
      where: error?.where,
      code: error?.code,
      details: error?.details,
    });
  }
}
