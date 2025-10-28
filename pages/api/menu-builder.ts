import { randomUUID } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { supaServer } from '@/lib/supaServer';

const isProd = process.env.NODE_ENV === 'production';

type SupabaseAction = 'select' | 'insert' | 'upsert';

function logSupabaseCall(
  action: SupabaseAction,
  table: string,
  fields?: string,
  payload?: unknown
) {
  let payloadLength: number | undefined;
  if (payload !== undefined) {
    try {
      payloadLength = JSON.stringify(payload).length;
    } catch (error) {
      console.warn('[menu-builder:supabase:payload-stringify-error]', {
        action,
        table,
        error,
      });
    }
  }
  console.debug('[menu-builder:supabase]', {
    action,
    table,
    fields,
    payloadLength,
  });
}

async function ensureAddonDraftsForRestaurant(
  supabase: typeof supaServer,
  restaurantId: string
) {
  const existingDrafts = await supabase
    .from('addon_groups_drafts')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .limit(1);

  if (existingDrafts.error) {
    throw Object.assign(existingDrafts.error, { where: 'check_existing_addon_groups_drafts' });
  }

  if ((existingDrafts.data ?? []).length > 0) {
    return { seeded: false };
  }

  const liveGroupsResponse = await supabase
    .from('addon_groups')
    .select(
      'id,name,multiple_choice,required,max_group_select,max_option_quantity'
    )
    .eq('restaurant_id', restaurantId)
    .is('archived_at', null);

  if (liveGroupsResponse.error) {
    throw Object.assign(liveGroupsResponse.error, { where: 'load_live_addon_groups' });
  }

  const liveGroups = liveGroupsResponse.data ?? [];
  if (liveGroups.length === 0) {
    return { seeded: false };
  }

  const groupIdMap = new Map<string, string>();
  const groupPayload = liveGroups.map((group) => {
    const newId = randomUUID();
    groupIdMap.set(String(group.id), newId);
    return {
      id: newId,
      restaurant_id: restaurantId,
      name: group.name,
      multiple_choice: group.multiple_choice,
      required: group.required,
      max_group_select: group.max_group_select,
      max_option_quantity: group.max_option_quantity,
      archived_at: null,
      state: 'draft',
    };
  });

  if (groupPayload.length === 0) {
    return { seeded: false };
  }

  const insertedGroupIds = groupPayload.map((group) => group.id);

  const insertGroupsResult = await supabase
    .from('addon_groups_drafts')
    .insert(groupPayload);

  if (insertGroupsResult.error) {
    throw Object.assign(insertGroupsResult.error, { where: 'insert_addon_groups_drafts' });
  }

  const liveGroupIds = liveGroups
    .map((group) => group.id)
    .filter((value) => value !== null && value !== undefined);

  if (liveGroupIds.length > 0) {
    const liveOptionsResponse = await supabase
      .from('addon_options')
      .select(
        'group_id,name,price,available,out_of_stock_until,stock_status,stock_return_date,stock_last_updated_at'
      )
      .in('group_id', liveGroupIds)
      .is('archived_at', null);

    if (liveOptionsResponse.error) {
      await supabase
        .from('addon_groups_drafts')
        .delete()
        .in('id', insertedGroupIds)
        .eq('restaurant_id', restaurantId);
      throw Object.assign(liveOptionsResponse.error, { where: 'load_live_addon_options' });
    }

    const optionPayload = (liveOptionsResponse.data ?? [])
      .map((option) => {
        const draftGroupId = groupIdMap.get(String(option.group_id));
        if (!draftGroupId) return undefined;
        return {
          restaurant_id: restaurantId,
          group_id: draftGroupId,
          name: option.name,
          price: option.price ?? null,
          available: option.available,
          out_of_stock_until: option.out_of_stock_until,
          stock_status: option.stock_status,
          stock_return_date: option.stock_return_date,
          stock_last_updated_at: option.stock_last_updated_at,
          archived_at: null,
          state: 'draft',
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;

    if (optionPayload.length > 0) {
      const insertOptionsResult = await supabase
        .from('addon_options_drafts')
        .insert(optionPayload);

      if (insertOptionsResult.error) {
        await supabase
          .from('addon_groups_drafts')
          .delete()
          .in('id', insertedGroupIds)
          .eq('restaurant_id', restaurantId);
        throw Object.assign(insertOptionsResult.error, { where: 'insert_addon_options_drafts' });
      }
    }
  }

  const liveLinksResponse = await supabase
    .from('item_addon_links')
    .select('group_id,item_id,menu_items!inner(id,restaurant_id,external_key)')
    .eq('menu_items.restaurant_id', restaurantId);

  if (liveLinksResponse.error) {
    throw Object.assign(liveLinksResponse.error, { where: 'load_live_addon_links' });
  }

  const linkPayload: Array<{
    restaurant_id: string;
    item_external_key: string;
    group_id_draft: string;
  }> = [];
  const seenLinks = new Set<string>();

  for (const link of liveLinksResponse.data ?? []) {
    const draftGroupId = groupIdMap.get(String(link.group_id));
    const menuItem = Array.isArray(link?.menu_items)
      ? link.menu_items[0]
      : link?.menu_items;
    const externalKey = menuItem?.external_key
      ? String(menuItem.external_key)
      : undefined;

    if (!draftGroupId || !externalKey) continue;

    const dedupeKey = `${externalKey}:${draftGroupId}`;
    if (seenLinks.has(dedupeKey)) continue;
    seenLinks.add(dedupeKey);

    linkPayload.push({
      restaurant_id: restaurantId,
      item_external_key: externalKey,
      group_id_draft: draftGroupId,
    });
  }

  const deleteDraftLinks = await supabase
    .from('item_addon_links_drafts')
    .delete()
    .eq('restaurant_id', restaurantId);

  if (deleteDraftLinks.error) {
    throw Object.assign(deleteDraftLinks.error, { where: 'reset_item_addon_links_drafts' });
  }

  if (linkPayload.length > 0) {
    const insertDraftLinks = await supabase
      .from('item_addon_links_drafts')
      .insert(linkPayload);

    if (insertDraftLinks.error) {
      throw Object.assign(insertDraftLinks.error, { where: 'insert_item_addon_links_drafts' });
    }
  }

  return { seeded: true };
}

function coerceId(input: unknown): string | undefined {
  if (typeof input === 'string' && input) return input;
  if (typeof input === 'number' && !Number.isNaN(input)) return String(input);
  return undefined;
}

function resolveRestaurantId(req: NextApiRequest): string | undefined {
  const q =
    coerceId(req.query.restaurant_id) ||
    coerceId(req.query.rid) ||
    coerceId((req.body as any)?.restaurantId) ||
    undefined;
  if (q) return q;
  if (!isProd) return process.env.NEXT_PUBLIC_DEMO_RESTAURANT_ID;
  return undefined;
}

type DraftPayload = {
  categories: Array<{ id?: string; tempId?: string; name: string; description?: string|null; sort_order?: number; image_url?: string|null }>;
  items: Array<{
    id?: string; tempId?: string; name: string; description?: string|null; price?: number|null;
    image_url?: string|null; is_vegetarian?: boolean; is_vegan?: boolean; is_18_plus?: boolean;
    stock_status?: string|null; available?: boolean; category_id?: string; sort_order?: number;
    external_key?: string;
    addons?: string[];
  }>;
  links?: Array<{ item_id: string; group_id: string }>; // IMPORTANT: group_id (schema uses group_id)
};

type DraftAddonLinkRow = {
  item_id: number | string;
  item_external_key: string | null;
  group_id: string;
  group_id_draft: string;
};

function ensureDraftPayload(input: unknown): DraftPayload {
  let parsed: unknown = input;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch (error) {
      throw Object.assign(new Error('draft must be valid JSON'), {
        statusCode: 400,
      });
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw Object.assign(new Error('draft must be a JSON object'), {
      statusCode: 400,
    });
  }

  try {
    JSON.stringify(parsed);
  } catch (error) {
    throw Object.assign(new Error('draft contains non-serializable values'), {
      statusCode: 400,
    });
  }

  return parsed as DraftPayload;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = supaServer;
  const restaurantId = resolveRestaurantId(req);
  const path = req.url || '/api/menu-builder';

  if (!restaurantId) {
    return res.status(400).json({ message: 'restaurant_id is required' });
  }

  try {
    if (req.method === 'GET') {
      const table = 'menu_drafts';
      let data: { draft: DraftPayload; updated_at: string } | null = null;
      const withAddonsParam = req.query.withAddons;
      const withAddons = Array.isArray(withAddonsParam)
        ? withAddonsParam.some((value) =>
            value === '' || value === '1' || value?.toLowerCase?.() === 'true'
          )
        : typeof withAddonsParam === 'string'
        ? withAddonsParam === '' || withAddonsParam === '1' || withAddonsParam.toLowerCase() === 'true'
        : false;
      const ensureAddonsDraftsParam = req.query.ensureAddonsDrafts;
      const ensureAddonsDrafts = Array.isArray(ensureAddonsDraftsParam)
        ? ensureAddonsDraftsParam.some((value) =>
            value === '' || value === '1' || value?.toLowerCase?.() === 'true'
          )
        : typeof ensureAddonsDraftsParam === 'string'
        ? ensureAddonsDraftsParam === '' ||
          ensureAddonsDraftsParam === '1' ||
          ensureAddonsDraftsParam.toLowerCase() === 'true'
        : false;
      let addonGroups: any[] | undefined;
      let addonLinks: DraftAddonLinkRow[] | undefined;
      let addonDraftsSeeded = false;

      try {
        logSupabaseCall('select', table, 'draft, updated_at');
        const response = await supabase
          .from(table)
          .select('draft, updated_at')
          .eq('restaurant_id', restaurantId)
          .maybeSingle()
          .throwOnError();
        data = response.data as typeof data;
      } catch (error: any) {
        console.error('Supabase error:', error?.message, error?.details, error?.hint);
        return res.status(500).json({ error: error?.message, details: error?.details, hint: error?.hint });
      }

      if (withAddons || ensureAddonsDrafts) {
        try {
          const seeded = await ensureAddonDraftsForRestaurant(supabase, restaurantId);
          addonDraftsSeeded = Boolean(seeded?.seeded);
        } catch (error: any) {
          console.error(
            'Supabase error:',
            error?.message,
            error?.details,
            error?.hint,
            error?.where
          );
          return res.status(500).json({
            error: error?.message,
            details: error?.details,
            hint: error?.hint,
            where: error?.where,
          });
        }

        try {
          logSupabaseCall(
            'select',
            'addon_groups_drafts',
            'id,name,multiple_choice,required,max_group_select,max_option_quantity,state,archived_at'
          );
          const groupsResponse = await supabase
            .from('addon_groups_drafts')
            .select(
              'id,restaurant_id,name,multiple_choice,required,max_group_select,max_option_quantity,state,archived_at'
            )
            .eq('restaurant_id', restaurantId)
            .eq('state', 'draft')
            .is('archived_at', null)
            .order('id', { ascending: true })
            .order('name', { ascending: true });

          if (groupsResponse.error) {
            throw groupsResponse.error;
          }

          const rawGroups = groupsResponse.data ?? [];
          const groupIds = rawGroups.map((group) => group.id).filter(Boolean);
          const optionMap = new Map<string, any[]>();

          if (groupIds.length > 0) {
            const optionsResponse = await supabase
              .from('addon_options_drafts')
              .select(
                'id,group_id,name,price,available,out_of_stock_until,stock_status,stock_return_date,stock_last_updated_at,state,archived_at'
              )
              .in('group_id', groupIds)
              .eq('state', 'draft')
              .is('archived_at', null);

            if (optionsResponse.error) {
              throw optionsResponse.error;
            }

            for (const option of optionsResponse.data ?? []) {
              const groupId = option.group_id ? String(option.group_id) : '';
              if (!groupId) continue;
              if (!optionMap.has(groupId)) optionMap.set(groupId, []);
              optionMap.get(groupId)!.push({
                ...option,
                id: String(option.id),
                group_id: groupId,
              });
            }
          }

          addonGroups = rawGroups.map((group) => ({
            ...group,
            id: String(group.id),
            addon_options: optionMap.get(String(group.id)) || [],
          }));
        } catch (error: any) {
          console.error('Supabase error:', error?.message, error?.details, error?.hint);
          return res.status(500).json({ error: error?.message, details: error?.details, hint: error?.hint });
        }

        try {
          logSupabaseCall('select', 'item_addon_links_drafts', 'item_external_key,group_id_draft');
          const linksResponse = await supabase
            .from('item_addon_links_drafts')
            .select('item_external_key,group_id_draft')
            .eq('restaurant_id', restaurantId);

          if (linksResponse.error) {
            throw linksResponse.error;
          }

          const draftLinks = linksResponse.data ?? [];
          const itemKeys = Array.from(
            new Set(
              draftLinks
                .map((link) => (link.item_external_key ? String(link.item_external_key) : undefined))
                .filter(Boolean) as string[]
            )
          );

          const externalKeyToItemId = new Map<string, number | string>();

          if (itemKeys.length > 0) {
            const itemsResponse = await supabase
              .from('menu_items')
              .select('id,external_key')
              .eq('restaurant_id', restaurantId)
              .in('external_key', itemKeys);

            if (itemsResponse.error) {
              throw itemsResponse.error;
            }

            for (const item of itemsResponse.data ?? []) {
              if (!item?.external_key) continue;
              externalKeyToItemId.set(String(item.external_key), item.id);
            }
          }

          addonLinks = draftLinks
            .map((link) => {
              const groupId = link.group_id_draft ? String(link.group_id_draft) : undefined;
              const externalKey = link.item_external_key
                ? String(link.item_external_key)
                : undefined;
              if (!groupId || !externalKey) return undefined;
              const itemId = externalKeyToItemId.get(externalKey);
              if (!itemId) return undefined;
              return {
                item_id: itemId,
                item_external_key: externalKey,
                group_id: groupId,
                group_id_draft: groupId,
              } as DraftAddonLinkRow;
            })
            .filter(Boolean) as DraftAddonLinkRow[];
        } catch (error: any) {
          console.error('Supabase error:', error?.message, error?.details, error?.hint);
          return res.status(500).json({ error: error?.message, details: error?.details, hint: error?.hint });
        }
      }

      if (!data) {
        let inserted: { draft: DraftPayload; updated_at: string };
        const emptyDraft: DraftPayload = { categories: [], items: [], links: [] };
        const insertPayload = { restaurant_id: restaurantId, draft: emptyDraft };
        try {
          logSupabaseCall('insert', table, 'draft, updated_at', insertPayload);
          const response = await supabase
            .from(table)
            .insert(insertPayload)
            .select('draft, updated_at')
            .single()
            .throwOnError();
          inserted = response.data as typeof inserted;
        } catch (error: any) {
          console.error('Supabase error:', error?.message, error?.details, error?.hint);
          return res.status(500).json({ error: error?.message, details: error?.details, hint: error?.hint });
        }
        return res.status(200).json({
          draft: inserted.draft,
          payload: inserted.draft,
          updated_at: inserted.updated_at,
          addonGroups: addonGroups ?? [],
          addonLinks: addonLinks ?? [],
          addonDraftsSeeded,
        });
      }
      return res.status(200).json({
        draft: data.draft,
        payload: data.draft,
        updated_at: data.updated_at,
        addonGroups: addonGroups ?? [],
        addonLinks: addonLinks ?? [],
        addonDraftsSeeded,
      });
    }

    if (req.method === 'PUT') {
      const incomingDraft = (req.body as { draft?: unknown }).draft;
      if (!incomingDraft) return res.status(400).json({ message: 'draft is required' });

      let draft: DraftPayload;
      try {
        draft = ensureDraftPayload(incomingDraft);
      } catch (error: any) {
        const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 400;
        return res.status(statusCode).json({ message: error?.message || 'invalid_draft' });
      }

      const table = 'menu_drafts';
      let data: { draft: DraftPayload; updated_at: string };

      const itemsWithKeys = (draft.items || []).map((item) => {
        if (item.external_key) return item;
        return { ...item, external_key: randomUUID() };
      });
      const updatedDraft: DraftPayload = { ...draft, items: itemsWithKeys };

      const upsertPayload = { restaurant_id: restaurantId, draft: updatedDraft };
      try {
        logSupabaseCall('upsert', table, 'draft, updated_at', upsertPayload);
        const response = await supabase
          .from(table)
          .upsert(upsertPayload, { onConflict: 'restaurant_id' })
          .select('draft, updated_at')
          .single()
          .throwOnError();
        data = response.data as typeof data;
      } catch (error: any) {
        console.error('Supabase error:', error?.message, error?.details, error?.hint);
        return res.status(500).json({ error: error?.message, details: error?.details, hint: error?.hint });
      }

      const safeItems = Array.isArray(updatedDraft.items) ? updatedDraft.items : [];
      const linkRows: Array<{ restaurant_id: string; item_external_key: string; group_id_draft: string }> = [];
      const seen = new Set<string>();
      for (const item of safeItems) {
        const itemKey = typeof item.external_key === 'string' && item.external_key ? item.external_key : undefined;
        if (!itemKey) continue;
        const addonIds = Array.isArray(item.addons) ? item.addons : [];
        for (const addonId of addonIds) {
          if (!addonId) continue;
          const strAddonId = String(addonId);
          const dedupeKey = `${itemKey}:${strAddonId}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);
          linkRows.push({
            restaurant_id: restaurantId,
            item_external_key: itemKey,
            group_id_draft: strAddonId,
          });
        }
      }

      try {
        await supabase
          .from('item_addon_links_drafts')
          .delete()
          .eq('restaurant_id', restaurantId);

        if (linkRows.length > 0) {
          await supabase.from('item_addon_links_drafts').insert(linkRows);
        }
      } catch (error: any) {
        console.error('[menu-builder:save-draft-links]', error);
        return res.status(500).json({
          message: 'failed_to_save_addon_links',
          error: error?.message,
          details: error?.details,
          hint: error?.hint,
        });
      }
      return res
        .status(200)
        .json({ draft: data.draft, payload: data.draft, updated_at: data.updated_at });
    }

    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).end('Method Not Allowed');
  } catch (e: any) {
    console.error('[draft:unhandled]', {
      path,
      restaurantId,
      error: e,
      message: e?.message,
      code: e?.code,
      details: e?.details,
      hint: e?.hint,
      stack: e?.stack,
    });
    return res.status(500).json({ message: e?.message || 'server_error' });
  }
}

