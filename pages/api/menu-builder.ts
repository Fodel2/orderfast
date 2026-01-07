import { randomUUID } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const isProd = process.env.NODE_ENV === 'production';

type SupabaseAction = 'select' | 'insert' | 'upsert';
type AddonAction =
  | 'create_addon_group'
  | 'update_addon_group'
  | 'delete_addon_group'
  | 'duplicate_addon_group'
  | 'reorder_addon_groups'
  | 'create_addon_option'
  | 'update_addon_option'
  | 'delete_addon_option'
  | 'reorder_addon_options'
  | 'assign_addon_group';

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
  supabase: SupabaseClient,
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
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ message: 'Missing Supabase server env vars' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
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
      const includePublishedAddonsParam = req.query.includePublishedAddons;
      const includePublishedAddons = Array.isArray(includePublishedAddonsParam)
        ? includePublishedAddonsParam.some((value) =>
            value === '' || value === '1' || value?.toLowerCase?.() === 'true'
          )
        : typeof includePublishedAddonsParam === 'string'
        ? includePublishedAddonsParam === '' ||
          includePublishedAddonsParam === '1' ||
          includePublishedAddonsParam.toLowerCase() === 'true'
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
      let publishedAddonGroups: any[] | undefined;
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

      if (withAddons || ensureAddonsDrafts || includePublishedAddons) {
        try {
          if (withAddons || ensureAddonsDrafts) {
            const seeded = await ensureAddonDraftsForRestaurant(supabase, restaurantId);
            addonDraftsSeeded = Boolean(seeded?.seeded);
            addonSeedStats = {
              groups: seeded?.groupsSeeded ?? 0,
              options: seeded?.optionsSeeded ?? 0,
              links: seeded?.linksSeeded ?? 0,
            };
          }
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

        if (withAddons || ensureAddonsDrafts) {
          try {
            logSupabaseCall(
              'select',
              'addon_groups_drafts',
              'id,name,multiple_choice,required,max_group_select,max_option_quantity,state,archived_at'
            );
            const groupsResponse = await supabase
              .from('addon_groups_drafts')
              .select(
                'id,restaurant_id,name,multiple_choice,required,max_group_select,max_option_quantity,state,archived_at,sort_order'
              )
              .eq('restaurant_id', restaurantId)
              .is('archived_at', null)
              .order('sort_order', { ascending: true })
              .order('name', { ascending: true });

            let rawGroups = groupsResponse.data ?? [];

            if (groupsResponse.error) {
              const gStatus = (groupsResponse.error as any)?.status;
              const gMessage = groupsResponse.error?.message?.toLowerCase?.() || '';
              const isUnauthorized =
                gStatus === 401 ||
                gStatus === 403 ||
                gMessage.includes('permission') ||
                gMessage.includes('not allowed') ||
                gMessage.includes('rls');
              const isMissingRelation =
                (groupsResponse.error as any)?.code === 'PGRST116' ||
                gStatus === 404 ||
                gMessage.includes('does not exist');

              if (!isUnauthorized && !isMissingRelation) {
                throw groupsResponse.error;
              }
              rawGroups = [];
            }

            if (rawGroups.length === 0) {
              const liveGroupsResponse = await supabase
                .from('addon_groups')
                .select(
                  'id,restaurant_id,name,multiple_choice,required,max_group_select,max_option_quantity,archived_at,sort_order'
                )
                .eq('restaurant_id', restaurantId)
                .is('archived_at', null)
                .order('sort_order', { ascending: true })
                .order('name', { ascending: true });

              if (liveGroupsResponse.error) {
                throw liveGroupsResponse.error;
              }

              rawGroups = (liveGroupsResponse.data ?? []).map((group) => ({
                ...group,
                state: 'published',
              }));
            }
            const groupIds = rawGroups.map((group) => group.id).filter(Boolean);
            const optionMap = new Map<string, any[]>();

            if (groupIds.length > 0) {
              const optionsResponse = await supabase
                .from('addon_options_drafts')
                .select(
                  'id,group_id,name,price,available,out_of_stock_until,stock_status,stock_return_date,stock_last_updated_at,state,archived_at,sort_order'
                )
                .in('group_id', groupIds)
                .is('archived_at', null);

              const optionsError = optionsResponse.error;
              let optionRows = optionsResponse.data ?? [];

              if (optionsError) {
                const optStatus = (optionsError as any)?.status;
                const optMessage = optionsError?.message?.toLowerCase?.() || '';
                const isUnauthorized =
                  optStatus === 401 ||
                  optStatus === 403 ||
                  optMessage.includes('permission') ||
                  optMessage.includes('not allowed') ||
                  optMessage.includes('rls');

                if (!isUnauthorized) {
                  throw optionsError;
                }
              }

              if (optionRows.length === 0) {
                const liveOptionsResponse = await supabase
                  .from('addon_options')
                  .select(
                    'id,group_id,name,price,available,out_of_stock_until,stock_status,stock_return_date,stock_last_updated_at,archived_at,sort_order'
                  )
                  .in('group_id', groupIds)
                  .is('archived_at', null);

                if (liveOptionsResponse.error) {
                  throw liveOptionsResponse.error;
                }

                optionRows = (liveOptionsResponse.data ?? []).map((option) => ({
                  ...option,
                  state: 'published',
                }));
              }

              for (const option of optionRows) {
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
        }

        if (includePublishedAddons) {
          try {
            const liveGroupsResponse = await supabase
              .from('addon_groups')
              .select(
                'id,restaurant_id,name,multiple_choice,required,max_group_select,max_option_quantity,archived_at,sort_order'
              )
              .eq('restaurant_id', restaurantId)
              .is('archived_at', null)
              .order('sort_order', { ascending: true })
              .order('name', { ascending: true });

            if (liveGroupsResponse.error) {
              throw liveGroupsResponse.error;
            }

            const liveGroups = liveGroupsResponse.data ?? [];
            const liveGroupIds = liveGroups.map((group) => group.id).filter(Boolean);
            const liveOptionMap = new Map<string, any[]>();

            if (liveGroupIds.length > 0) {
              const liveOptionsResponse = await supabase
                .from('addon_options')
                .select(
                  'id,group_id,name,price,available,out_of_stock_until,stock_status,stock_return_date,stock_last_updated_at,archived_at,sort_order'
                )
                .in('group_id', liveGroupIds)
                .is('archived_at', null);

              if (liveOptionsResponse.error) {
                throw liveOptionsResponse.error;
              }

              for (const option of liveOptionsResponse.data ?? []) {
                const groupId = option.group_id ? String(option.group_id) : '';
                if (!groupId) continue;
                if (!liveOptionMap.has(groupId)) liveOptionMap.set(groupId, []);
                liveOptionMap.get(groupId)!.push({
                  ...option,
                  id: String(option.id),
                  group_id: groupId,
                });
              }
            }

            publishedAddonGroups = liveGroups.map((group) => ({
              ...group,
              id: String(group.id),
              addon_options: liveOptionMap.get(String(group.id)) || [],
            }));
          } catch (error: any) {
            console.error('Supabase error:', error?.message, error?.details, error?.hint);
            return res.status(500).json({ error: error?.message, details: error?.details, hint: error?.hint });
          }
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
          publishedAddonGroups: publishedAddonGroups ?? [],
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
        publishedAddonGroups: publishedAddonGroups ?? [],
        addonDraftsSeeded,
        addonSeedStats,
      });
    }

    if (req.method === 'POST') {
      const { action } = req.body as { action?: AddonAction };
      if (!action) {
        return res.status(400).json({ message: 'action is required' });
      }

      await ensureAddonDraftsForRestaurant(supabase, restaurantId);

      if (action === 'create_addon_group') {
        const {
          name,
          multiple_choice,
          required,
          max_group_select,
          max_option_quantity,
        } = req.body as Record<string, any>;
        if (!name) return res.status(400).json({ message: 'name is required' });

        const { data: lastGroup } = await supabase
          .from('addon_groups_drafts')
          .select('sort_order')
          .eq('restaurant_id', restaurantId)
          .order('sort_order', { ascending: false })
          .limit(1)
          .maybeSingle();

        const sort_order =
          typeof lastGroup?.sort_order === 'number' ? lastGroup.sort_order + 1 : 0;

        const payload = {
          restaurant_id: restaurantId,
          name,
          multiple_choice: !!multiple_choice,
          required: !!required,
          max_group_select: max_group_select ?? null,
          max_option_quantity: max_option_quantity ?? null,
          archived_at: null,
          state: 'draft',
          sort_order,
        };

        const { data, error } = await supabase
          .from('addon_groups_drafts')
          .insert([payload])
          .select('*')
          .single();

        if (error) {
          return res.status(500).json({ message: error.message });
        }
        return res.status(200).json({ group: data });
      }

      if (action === 'update_addon_group') {
        const { groupId, name, multiple_choice, required, max_group_select, max_option_quantity } =
          req.body as Record<string, any>;
        if (!groupId) return res.status(400).json({ message: 'groupId is required' });

        const { error } = await supabase
          .from('addon_groups_drafts')
          .update({
            name,
            multiple_choice,
            required,
            max_group_select: max_group_select ?? null,
            max_option_quantity: max_option_quantity ?? null,
          })
          .eq('id', groupId)
          .eq('restaurant_id', restaurantId);

        if (error) {
          return res.status(500).json({ message: error.message });
        }
        return res.status(200).json({ ok: true });
      }

      if (action === 'delete_addon_group') {
        const { groupId } = req.body as Record<string, any>;
        if (!groupId) return res.status(400).json({ message: 'groupId is required' });

        const deletions = await Promise.all([
          supabase
            .from('addon_options_drafts')
            .delete()
            .eq('group_id', groupId)
            .eq('restaurant_id', restaurantId),
          supabase
            .from('item_addon_links_drafts')
            .delete()
            .eq('group_id', groupId)
            .eq('restaurant_id', restaurantId),
          supabase
            .from('addon_groups_drafts')
            .delete()
            .eq('id', groupId)
            .eq('restaurant_id', restaurantId),
        ]);

        const firstError = deletions.find((res) => res.error)?.error;
        if (firstError) {
          return res.status(500).json({ message: firstError.message });
        }
        return res.status(200).json({ ok: true });
      }

      if (action === 'duplicate_addon_group') {
        const { groupId } = req.body as Record<string, any>;
        if (!groupId) return res.status(400).json({ message: 'groupId is required' });

        const { data: group, error: groupError } = await supabase
          .from('addon_groups_drafts')
          .select('*')
          .eq('id', groupId)
          .eq('restaurant_id', restaurantId)
          .maybeSingle();

        if (groupError || !group) {
          return res.status(500).json({ message: groupError?.message || 'Group not found' });
        }

        const { data: lastGroup } = await supabase
          .from('addon_groups_drafts')
          .select('sort_order')
          .eq('restaurant_id', restaurantId)
          .order('sort_order', { ascending: false })
          .limit(1)
          .maybeSingle();

        const sort_order =
          typeof lastGroup?.sort_order === 'number' ? lastGroup.sort_order + 1 : 0;

        const { data: newGroup, error: insertError } = await supabase
          .from('addon_groups_drafts')
          .insert([
            {
              name: `${group.name} - copy`,
              multiple_choice: group.multiple_choice,
              required: group.required,
              restaurant_id: restaurantId,
              max_group_select: group.max_group_select,
              max_option_quantity: group.max_option_quantity,
              archived_at: null,
              state: 'draft',
              sort_order,
            },
          ])
          .select('*')
          .single();

        if (insertError || !newGroup) {
          return res.status(500).json({ message: insertError?.message || 'Failed to duplicate' });
        }

        const { data: options, error: optionError } = await supabase
          .from('addon_options_drafts')
          .select('*')
          .eq('group_id', groupId)
          .eq('restaurant_id', restaurantId)
          .is('archived_at', null)
          .order('sort_order', { ascending: true });

        if (optionError) {
          return res.status(500).json({ message: optionError.message });
        }

        if (options?.length) {
          const rows = options.map((opt, idx) => ({
            name: opt.name,
            price: opt.price,
            available: opt.available,
            group_id: newGroup.id,
            out_of_stock_until: opt.out_of_stock_until,
            stock_status: opt.stock_status,
            stock_return_date: opt.stock_return_date,
            stock_last_updated_at: opt.stock_last_updated_at,
            restaurant_id: restaurantId,
            archived_at: null,
            state: 'draft',
            sort_order: idx,
          }));
          const { error: insertOptionsError } = await supabase
            .from('addon_options_drafts')
            .insert(rows);
          if (insertOptionsError) {
            return res.status(500).json({ message: insertOptionsError.message });
          }
        }

        return res.status(200).json({ group: newGroup });
      }

      if (action === 'reorder_addon_groups') {
        const { updates } = req.body as { updates?: Array<{ id: string; sort_order: number }> };
        if (!Array.isArray(updates)) {
          return res.status(400).json({ message: 'updates is required' });
        }
        const results = await Promise.all(
          updates.map((row) =>
            supabase
              .from('addon_groups_drafts')
              .update({ sort_order: row.sort_order })
              .eq('id', row.id)
              .eq('restaurant_id', restaurantId)
          )
        );
        const firstError = results.find((res) => res.error)?.error;
        if (firstError) {
          return res.status(500).json({ message: firstError.message });
        }
        return res.status(200).json({ ok: true });
      }

      if (action === 'create_addon_option') {
        const { groupId, name, price, sortOrder } = req.body as Record<string, any>;
        if (!groupId) return res.status(400).json({ message: 'groupId is required' });
        if (name == null) return res.status(400).json({ message: 'name is required' });

        const payload = {
          restaurant_id: restaurantId,
          group_id: groupId,
          name,
          price: price ?? 0,
          available: true,
          archived_at: null,
          state: 'draft',
          sort_order: typeof sortOrder === 'number' ? sortOrder : 0,
        };

        const { data, error } = await supabase
          .from('addon_options_drafts')
          .insert([payload])
          .select(
            'id,group_id,name,price,available,out_of_stock_until,stock_status,stock_return_date,stock_last_updated_at,sort_order'
          )
          .single();

        if (error) {
          return res.status(500).json({ message: error.message });
        }
        return res.status(200).json({ option: data });
      }

      if (action === 'update_addon_option') {
        const { optionId, groupId, fields } = req.body as Record<string, any>;
        if (!optionId) return res.status(400).json({ message: 'optionId is required' });

        const { error } = await supabase
          .from('addon_options_drafts')
          .update(fields)
          .eq('id', optionId)
          .eq('restaurant_id', restaurantId);

        if (error) {
          return res.status(500).json({ message: error.message });
        }
        return res.status(200).json({ ok: true, groupId });
      }

      if (action === 'delete_addon_option') {
        const { optionId } = req.body as Record<string, any>;
        if (!optionId) return res.status(400).json({ message: 'optionId is required' });

        const { error } = await supabase
          .from('addon_options_drafts')
          .delete()
          .eq('id', optionId)
          .eq('restaurant_id', restaurantId);

        if (error) {
          return res.status(500).json({ message: error.message });
        }
        return res.status(200).json({ ok: true });
      }

      if (action === 'reorder_addon_options') {
        const { updates } = req.body as { updates?: Array<{ id: string; sort_order: number }> };
        if (!Array.isArray(updates)) {
          return res.status(400).json({ message: 'updates is required' });
        }
        const results = await Promise.all(
          updates.map((row) =>
            supabase
              .from('addon_options_drafts')
              .update({ sort_order: row.sort_order })
              .eq('id', row.id)
              .eq('restaurant_id', restaurantId)
          )
        );
        const firstError = results.find((res) => res.error)?.error;
        if (firstError) {
          return res.status(500).json({ message: firstError.message });
        }
        return res.status(200).json({ ok: true });
      }

      if (action === 'assign_addon_group') {
        const { groupId, items } = req.body as {
          groupId?: string;
          items?: Array<{ id: string; external_key?: string | null }>;
        };
        if (!groupId) return res.status(400).json({ message: 'groupId is required' });

        const uniqueItems = Array.from(
          new Map((items || []).map((item) => [String(item.id), item])).values()
        );
        const itemIds = uniqueItems.map((item) => String(item.id));

        const { data: itemRows, error: itemError } = await supabase
          .from('menu_items')
          .select('id,restaurant_id,external_key')
          .eq('restaurant_id', restaurantId)
          .in('id', itemIds);

        if (itemError) {
          return res.status(500).json({ message: itemError.message });
        }

        const externalKeyMap: Record<string, string> = {};
        const missingKeys = (itemRows || []).filter((row) => !row.external_key);

        for (const row of itemRows || []) {
          if (row.external_key) {
            externalKeyMap[String(row.id)] = String(row.external_key);
          }
        }

        for (const row of missingKeys) {
          const newKey = randomUUID();
          const { error: updateError } = await supabase
            .from('menu_items')
            .update({ external_key: newKey })
            .eq('id', row.id)
            .eq('restaurant_id', restaurantId);
          if (updateError) {
            return res.status(500).json({ message: updateError.message });
          }
          externalKeyMap[String(row.id)] = newKey;
        }

        await supabase
          .from('item_addon_links_drafts')
          .delete()
          .eq('restaurant_id', restaurantId)
          .eq('group_id', groupId);

        const rows = uniqueItems.map((item) => ({
          id: randomUUID(),
          restaurant_id: restaurantId,
          item_id: String(item.id),
          item_external_key: externalKeyMap[String(item.id)],
          group_id: groupId,
          state: 'draft',
        }));

        if (rows.length) {
          const { error: insertError } = await supabase
            .from('item_addon_links_drafts')
            .insert(rows);
          if (insertError) {
            return res.status(500).json({ message: insertError.message });
          }
        }

        const { data: draftGroup } = await supabase
          .from('addon_groups_drafts')
          .select('name')
          .eq('id', groupId)
          .eq('restaurant_id', restaurantId)
          .maybeSingle();

        if (draftGroup?.name && itemIds.length) {
          const { data: liveGroup } = await supabase
            .from('addon_groups')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .eq('name', draftGroup.name)
            .is('archived_at', null)
            .maybeSingle();

          if (liveGroup?.id) {
            await supabase
              .from('item_addon_links')
              .delete()
              .eq('group_id', liveGroup.id)
              .in('item_id', itemIds);

            const liveRows = itemIds.map((itemId) => ({
              item_id: itemId,
              group_id: liveGroup.id,
            }));
            if (liveRows.length) {
              await supabase
                .from('item_addon_links')
                .upsert(liveRows, { onConflict: 'item_id,group_id' });
            }
          }
        }

        return res.status(200).json({ ok: true, externalKeyMap });
      }

      return res.status(400).json({ message: 'Unknown action' });
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

    res.setHeader('Allow', ['GET', 'PUT', 'POST']);
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
