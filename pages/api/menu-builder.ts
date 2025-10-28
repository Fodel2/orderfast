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

  const seedResult = await supabase.rpc('seed_addon_drafts', {
    p_restaurant_id: restaurantId,
  });

  if (seedResult.error) {
    throw Object.assign(seedResult.error, { where: 'seed_addon_drafts_rpc' });
  }

  const payload = Array.isArray(seedResult.data) ? seedResult.data[0] : seedResult.data;
  return {
    seeded: Boolean(payload?.groups_seeded || payload?.options_seeded || payload?.links_seeded),
    groupsSeeded: payload?.groups_seeded ?? 0,
    optionsSeeded: payload?.options_seeded ?? 0,
    linksSeeded: payload?.links_seeded ?? 0,
  };
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
      let addonSeedStats: { groups: number; options: number; links: number } | undefined;

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
          addonSeedStats = {
            groups: seeded?.groupsSeeded ?? 0,
            options: seeded?.optionsSeeded ?? 0,
            links: seeded?.linksSeeded ?? 0,
          };
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
          logSupabaseCall('select', 'item_addon_links_drafts', 'item_external_key,group_id,item_id');
          const linksResponse = await supabase
            .from('item_addon_links_drafts')
            .select('item_external_key,group_id,item_id')
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
              const groupId = link.group_id ? String(link.group_id) : undefined;
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
          addonSeedStats,
        });
      }
      return res.status(200).json({
        draft: data.draft,
        payload: data.draft,
        updated_at: data.updated_at,
        addonGroups: addonGroups ?? [],
        addonLinks: addonLinks ?? [],
        addonDraftsSeeded,
        addonSeedStats,
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
      const linkRows: Array<{
        id?: string;
        restaurant_id: string;
        item_external_key: string;
        group_id: string;
        state?: string;
        item_id?: string | null;
      }> = [];
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
            id: randomUUID(),
            restaurant_id: restaurantId,
            item_external_key: itemKey,
            group_id: strAddonId,
            state: 'draft',
            item_id: typeof item.id === 'string' || typeof item.id === 'number'
              ? String(item.id)
              : undefined,
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

