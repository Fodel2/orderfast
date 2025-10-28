import type { NextApiRequest, NextApiResponse } from 'next';
import { supaServer } from '@/lib/supaServer';

type ColumnCheck = {
  table: string;
  column: string;
};

type ColumnStatus = Record<string, { exists: boolean; error?: string | null }>;

const REQUIRED_COLUMNS: ColumnCheck[] = [
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
  const query = req.query;
  const fromQuery = (query.restaurant_id || query.rid) as string | string[] | undefined;
  if (typeof fromQuery === 'string' && fromQuery) return fromQuery;
  if (Array.isArray(fromQuery)) return fromQuery[0];
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
    return res.status(400).json({ message: 'restaurant_id is required' });
  }

  try {
    // Basic counts
    const [
      { count: liveGroupsCount, error: liveGroupsError },
      { count: draftGroupsCount, error: draftGroupsError },
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
    ]);

    if (liveGroupsError) throw Object.assign(liveGroupsError, { where: 'count_live_groups' });
    if (draftGroupsError) throw Object.assign(draftGroupsError, { where: 'count_draft_groups' });

    const [liveOptions, draftOptions, draftLinks] = await Promise.all([
      supaServer
        .from('addon_options')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .is('archived_at', null),
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
    ]);

    if (liveOptions.error) throw Object.assign(liveOptions.error, { where: 'count_live_options' });
    if (draftOptions.error) throw Object.assign(draftOptions.error, { where: 'count_draft_options' });
    if (draftLinks.error) throw Object.assign(draftLinks.error, { where: 'count_draft_links' });

    const columnStatus: ColumnStatus = {};
    for (const check of REQUIRED_COLUMNS) {
      const key = `${check.table}.${check.column}`;
      try {
        const { error } = await supaServer
          .from(check.table)
          .select(check.column)
          .limit(1);
        if (error && error.code === '42703') {
          columnStatus[key] = { exists: false, error: error.message };
        } else if (error) {
          columnStatus[key] = { exists: false, error: error.message };
        } else {
          columnStatus[key] = { exists: true };
        }
      } catch (error: any) {
        columnStatus[key] = { exists: false, error: error?.message || 'unknown_error' };
      }
    }

    const linkSampleResponse = await supaServer
      .from('item_addon_links_drafts')
      .select('item_external_key,group_id,item_id')
      .eq('restaurant_id', restaurantId)
      .limit(5);

    if (linkSampleResponse.error) {
      throw Object.assign(linkSampleResponse.error, { where: 'sample_draft_links' });
    }

    const sampleLinks = linkSampleResponse.data ?? [];
    const sampleItemKey = sampleLinks.find((row) => row.item_external_key)?.item_external_key as string | undefined;
    let modalGroupsCount: number | null = null;

    if (sampleItemKey) {
      const { data: itemRow, error: itemLookupError } = await supaServer
        .from('menu_items')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('external_key', sampleItemKey)
        .maybeSingle();

      if (itemLookupError) {
        throw Object.assign(itemLookupError, { where: 'lookup_item_for_sample' });
      }

      if (itemRow?.id) {
        const { data: modalGroups, error: modalError } = await supaServer
          .from('item_addon_links')
          .select('group_id')
          .eq('item_id', itemRow.id)
          .limit(5);

        if (modalError && modalError.code !== 'PGRST116') {
          throw Object.assign(modalError, { where: 'modal_query_live_addons' });
        }

        modalGroupsCount = modalGroups?.length ?? 0;
      }
    }

    const draftLinkData = sampleLinks.map((row) => ({
      item_external_key: row.item_external_key,
      group_id: row.group_id,
      item_id: row.item_id,
    }));

    const unresolved: { missingItems: string[]; missingGroups: string[] } = {
      missingItems: [],
      missingGroups: [],
    };

    if (draftLinkData.length > 0) {
      const draftGroupIds = Array.from(
        new Set(
          draftLinkData
            .map((row) => (row.group_id ? String(row.group_id) : undefined))
            .filter(Boolean) as string[],
        ),
      );
      const draftItemKeys = Array.from(
        new Set(
          draftLinkData
            .map((row) => (row.item_external_key ? String(row.item_external_key) : undefined))
            .filter(Boolean) as string[],
        ),
      );

      if (draftGroupIds.length > 0) {
        const { data: groupsData, error: groupsError } = await supaServer
          .from('addon_groups_drafts')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .in('id', draftGroupIds);
        if (groupsError) throw Object.assign(groupsError, { where: 'validate_draft_groups' });
        const seen = new Set((groupsData ?? []).map((row) => String(row.id)));
        unresolved.missingGroups = draftGroupIds.filter((gid) => !seen.has(gid));
      }

      if (draftItemKeys.length > 0) {
        const { data: itemsData, error: itemsError } = await supaServer
          .from('menu_items')
          .select('external_key')
          .eq('restaurant_id', restaurantId)
          .in('external_key', draftItemKeys);
        if (itemsError) throw Object.assign(itemsError, { where: 'validate_draft_items' });
        const seenItems = new Set((itemsData ?? []).map((row) => String(row.external_key)));
        unresolved.missingItems = draftItemKeys.filter((key) => !seenItems.has(key));
      }
    }

    const publishReady = unresolved.missingItems.length === 0 && unresolved.missingGroups.length === 0;

    return res.status(200).json({
      restaurantId,
      counts: {
        liveGroups: liveGroupsCount ?? 0,
        draftGroups: draftGroupsCount ?? 0,
        liveOptions: liveOptions.count ?? 0,
        draftOptions: draftOptions.count ?? 0,
        draftLinks: draftLinks.count ?? 0,
      },
      columnStatus,
      sampleLinks: draftLinkData,
      modalGroupsCount,
      publishReady,
      unresolved,
    });
  } catch (error: any) {
    console.error('[menu-builder-debug:error]', {
      restaurantId,
      message: error?.message,
      code: error?.code,
      details: error?.details,
      where: error?.where,
    });
    return res.status(500).json({
      message: error?.message || 'menu_builder_debug_failed',
      code: error?.code,
      details: error?.details,
      where: error?.where,
    });
  }
}
