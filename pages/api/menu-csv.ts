import { randomUUID } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import Papa from 'papaparse';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { supaServer } from '@/lib/supaServer';

const isProd = process.env.NODE_ENV === 'production';

type CsvMode = 'import' | 'bulk';

type RowInput = {
  id?: string | number | null;
  external_key?: string | null;
  name?: string;
  price?: string | number;
  category?: string;
  description?: string;
  tags?: string;
};

type ParsedRow = {
  id?: string | number | null;
  external_key?: string | null;
  name: string;
  price: number;
  category: string;
  description: string | null;
  tags: string[];
};

type ItemUpdate = {
  id: string | number;
  data: Record<string, any>;
};

// Allowed tag fields on menu_items
type TagFlagField = 'is_vegan' | 'is_vegetarian' | 'is_18_plus';

// CSV tag → field mapping
const TAG_FIELDS: Record<string, TagFlagField> = {
  vegan: 'is_vegan',
  vegetarian: 'is_vegetarian',
  '18_plus': 'is_18_plus',
  '18+': 'is_18_plus',
};

const ALLOWED_TAGS = Object.keys(TAG_FIELDS);

function normalizeTag(input: string) {
  const lowered = input.trim().toLowerCase();
  return lowered.replace(/\s+/g, '_').replace(/-/g, '_');
}

function coerceId(input: unknown): string | undefined {
  if (typeof input === 'string' && input) return input;
  if (typeof input === 'number' && !Number.isNaN(input)) return String(input);
  return undefined;
}

async function resolveRestaurantId(req: NextApiRequest, res: NextApiResponse) {
  const supabaseAuth = createServerSupabaseClient({ req, res });
  const {
    data: { session },
  } = await supabaseAuth.auth.getSession();

  if (!session) {
    return { restaurantId: undefined, sessionUserId: undefined };
  }

  const { data: ru, error } = await supaServer
    .from('restaurant_users')
    .select('restaurant_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error) {
    return { restaurantId: undefined, sessionUserId: session.user.id, error };
  }

  if (ru?.restaurant_id) {
    return { restaurantId: String(ru.restaurant_id), sessionUserId: session.user.id };
  }

  if (!isProd) {
    const fallback = coerceId(process.env.NEXT_PUBLIC_DEMO_RESTAURANT_ID);
    if (fallback) return { restaurantId: fallback, sessionUserId: session.user.id };
  }

  return { restaurantId: undefined, sessionUserId: session.user.id };
}

function parseCsvString(contents: string): RowInput[] {
  const result = Papa.parse(contents, { header: true, skipEmptyLines: true });
  if (result.errors?.length) {
    throw Object.assign(new Error(result.errors[0]?.message || 'Failed to parse CSV'), {
      status: 400,
    });
  }
  const rows = (result.data as any[]) || [];
  return rows.map((row) => ({
    id: row.id ?? row.item_id ?? row.ID,
    external_key: row.external_key ?? row.externalKey,
    name: row.name ?? row.Name,
    price: row.price ?? row.Price,
    category: row.category ?? row.Category,
    description: row.description ?? row.Description,
    tags: row.tags ?? row.Tags,
  }));
}

function validateRows(rows: RowInput[]) {
  const rowErrors: Array<{ rowIndex: number; reason: string }> = [];
  const parsed: ParsedRow[] = rows.map((row, idx) => {
    const name = (row.name || '').toString().trim();
    const category = (row.category || '').toString().trim();
    const priceNum = Number(row.price);
    if (!name) rowErrors.push({ rowIndex: idx + 1, reason: 'Name is required' });
    if (!category) rowErrors.push({ rowIndex: idx + 1, reason: 'Category is required' });
    if (!row.price || Number.isNaN(priceNum) || priceNum <= 0) {
      rowErrors.push({ rowIndex: idx + 1, reason: 'Price must be greater than 0' });
    }
    const tags = (row.tags || '')
      .toString()
      .split(/[,|]/)
      .map((t) => normalizeTag(t))
      .filter(Boolean);
    const invalid = tags.filter((t) => !ALLOWED_TAGS.includes(t));
    if (invalid.length) {
      rowErrors.push({ rowIndex: idx + 1, reason: `Unsupported tags: ${invalid.join(', ')}` });
    }
    return {
      id: row.id ?? null,
      external_key: row.external_key ?? null,
      name,
      category,
      price: priceNum,
      description: row.description ? String(row.description).trim() : null,
      tags,
    };
  });
  return { rowErrors, parsed };
}

function buildTagFlags(tags: string[]) {
  const tagFlags: Record<TagFlagField, boolean> = {
    is_vegan: false,
    is_vegetarian: false,
    is_18_plus: false,
  };
  tags.forEach((tag) => {
    const normalized = normalizeTag(tag);
    const field = TAG_FIELDS[normalized];
    if (field) tagFlags[field] = true;
  });
  return tagFlags;
}

function buildTagListFromFlags(item: { is_vegan?: boolean | null; is_vegetarian?: boolean | null; is_18_plus?: boolean | null }) {
  const tags: string[] = [];
  if (item?.is_vegan) tags.push('vegan');
  if (item?.is_vegetarian) tags.push('vegetarian');
  if (item?.is_18_plus) tags.push('18+');
  return tags.join(', ');
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const mode = typeof req.query.mode === 'string' ? req.query.mode : undefined;
  if (mode === 'sample') {
    const sampleRows = [
      { name: 'Signature Burger', price: '12.50', category: 'Burgers', description: 'Our classic burger with house sauce', tags: 'vegetarian' },
    ];
    const csv = Papa.unparse(sampleRows, { columns: ['name', 'price', 'category', 'description', 'tags'] });
    res.setHeader('Content-Type', 'text/csv;charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="menu-sample.csv"');
    return res.status(200).send(csv);
  }

  if (mode === 'export') {
    const { restaurantId, error } = await resolveRestaurantId(req, res);
    if (error) {
      return res.status(500).json({ ok: false, message: error.message, details: error.details });
    }
    if (!restaurantId) {
      return res.status(401).json({ ok: false, message: 'Not authorized to export menu' });
    }

    const { data: categories, error: catError } = await supaServer
      .from('menu_categories')
      .select('id,name')
      .eq('restaurant_id', restaurantId)
      .is('archived_at', null);
    if (catError) {
      return res.status(500).json({ ok: false, message: catError.message, details: catError.details });
    }
    const categoryMap = new Map<string, string>();
    (categories || []).forEach((c) => {
      if (c.id && c.name) categoryMap.set(String(c.id), String(c.name));
    });

    const { data: items, error: itemsError } = await supaServer
      .from('menu_items')
      .select('id,external_key,name,price,category_id,description,is_vegan,is_vegetarian,is_18_plus')
      .eq('restaurant_id', restaurantId)
      .is('archived_at', null);
    if (itemsError) {
      return res.status(500).json({ ok: false, message: itemsError.message, details: itemsError.details });
    }

    const rows = (items || []).map((item) => ({
      id: item.id,
      external_key: item.external_key,
      name: item.name || '',
      price: typeof item.price === 'number' ? item.price.toFixed(2) : '',
      category: categoryMap.get(String(item.category_id)) || '',
      description: item.description || '',
      tags: buildTagListFromFlags(item),
    }));

    const csv = Papa.unparse(rows, {
      columns: ['id', 'external_key', 'name', 'price', 'category', 'description', 'tags'],
    });
    res.setHeader('Content-Type', 'text/csv;charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="menu-export.csv"');
    return res.status(200).send(csv);
  }

  return res.status(400).json({ ok: false, message: 'Unsupported mode' });
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const { restaurantId, error, sessionUserId } = await resolveRestaurantId(req, res);
  if (error) {
    return res.status(500).json({ ok: false, message: error.message, details: error.details });
  }
  if (!restaurantId) {
    return res.status(401).json({ ok: false, message: 'Not authorized for this restaurant', userId: sessionUserId });
  }

  const body = (req.body || {}) as { mode?: CsvMode; rows?: RowInput[]; confirm?: boolean; csv?: string };
  const mode = body.mode;
  if (!mode || (mode !== 'import' && mode !== 'bulk')) {
    return res.status(400).json({ ok: false, message: 'mode must be import or bulk' });
  }

  let incomingRows: RowInput[] = [];
  if (Array.isArray(body.rows)) {
    incomingRows = body.rows;
  } else if (typeof body.csv === 'string') {
    try {
      incomingRows = parseCsvString(body.csv);
    } catch (err: any) {
      return res.status(err?.status || 400).json({ ok: false, message: err?.message || 'Failed to parse CSV' });
    }
  } else {
    return res.status(400).json({ ok: false, message: 'rows are required' });
  }

  const { rowErrors, parsed } = validateRows(incomingRows);
  if (rowErrors.length) {
    return res.status(400).json({ ok: false, message: 'Validation failed', rowErrors });
  }

  const { data: categories, error: catError } = await supaServer
    .from('menu_categories')
    .select('id,name,sort_order,archived_at')
    .eq('restaurant_id', restaurantId)
    .is('archived_at', null);
  if (catError) {
    return res.status(500).json({ ok: false, message: catError.message, details: catError.details });
  }

  const { data: items, error: itemsError } = await supaServer
    .from('menu_items')
    .select('id,name,category_id,archived_at,is_vegan,is_vegetarian,is_18_plus,price,description,external_key')
    .eq('restaurant_id', restaurantId)
    .is('archived_at', null);
  if (itemsError) {
    return res.status(500).json({ ok: false, message: itemsError.message, details: itemsError.details });
  }

  try {
    const categoryMap = new Map<string, { id: string | number; sort_order?: number }>();
    (categories || []).forEach((c) => {
      if (c?.name) categoryMap.set(c.name.trim().toLowerCase(), c as any);
    });
    let nextSort = Math.max(0, ...(categories || []).map((c: any) => c.sort_order || 0)) + 1;

    const ensureCategory = async (name: string) => {
      const categoryName = name.trim();
      const key = categoryName.toLowerCase();
      if (categoryMap.has(key)) return categoryMap.get(key)!.id;

      const { data: existing, error: existingError } = await supaServer
        .from('menu_categories')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .ilike('name', categoryName)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existing?.id) {
        categoryMap.set(key, { id: existing.id });
        return existing.id;
      }

      const insert = await supaServer
        .from('menu_categories')
        .insert({ name: categoryName, restaurant_id: restaurantId, sort_order: nextSort++ })
        .select('id')
        .single();
      if (insert.error) {
        throw insert.error;
      }
      const id = insert.data?.id;
      categoryMap.set(key, { id });
      return id;
    };

    const itemsById = new Map<string, any>();
    const itemsByName = new Map<string, any>();
    (items || []).forEach((item) => {
      if (item?.id) itemsById.set(String(item.id), item);
      if (item?.name) itemsByName.set(item.name.toLowerCase(), item);
      if (item?.external_key) itemsById.set(String(item.external_key), item);
    });

    const inserts: Record<string, any>[] = [];
    const updates: ItemUpdate[] = [];
    const touchedIds = new Set<string>();

    for (const row of parsed) {
      const categoryId = await ensureCategory(row.category);
      const tagFlags = buildTagFlags(row.tags);
      const payload = {
        restaurant_id: restaurantId,
        name: row.name,
        category_id: categoryId,
        price: row.price,
        description: row.description,
        ...tagFlags,
      } as Record<string, any>;

      const identifier = row.id ? String(row.id) : row.external_key ? String(row.external_key) : undefined;
      const existing = identifier
        ? itemsById.get(identifier)
        : itemsByName.get(row.name.toLowerCase());

      if (mode === 'bulk' && existing) {
        touchedIds.add(String(existing.id));
        updates.push({ id: existing.id, data: payload });
      } else if (mode === 'bulk' && !existing) {
        payload.external_key = row.external_key || randomUUID();
        inserts.push(payload);
      } else if (mode === 'import') {
        payload.external_key = row.external_key || randomUUID();
        inserts.push(payload);
      }
    }

    const toArchive =
      mode === 'bulk'
        ? (items || []).filter((i) => !touchedIds.has(String(i.id)))
        : [];

    if (mode === 'bulk' && !body.confirm) {
      return res.status(200).json({
        ok: true,
        mode: 'bulk',
        preview: {
          willCreate: inserts.length,
          willUpdate: updates.length,
          willArchive: toArchive.length,
        },
      });
    }

    const summary = { created: 0, updated: 0, archived: 0 };

    if (inserts.length) {
      for (const payload of inserts) {
        const { error: upsertError } = await supaServer
          .from('menu_items')
          .upsert(payload, { onConflict: 'restaurant_id,external_key', ignoreDuplicates: false })
          .select('id')
          .single();

        if (upsertError) {
          const itemName = payload.name || 'item';
          return res.status(400).json({
            ok: false,
            message: `Failed to upsert item "${itemName}": ${upsertError.message}`,
            details: upsertError.details,
          });
        }
        summary.created += 1;
      }
    }

    if (updates.length) {
      for (const entry of updates) {
        const resUpdate = await supaServer
          .from('menu_items')
          .update(entry.data)
          .eq('id', entry.id)
          .eq('restaurant_id', restaurantId);
        if (resUpdate.error) {
          return res.status(500).json({ ok: false, message: resUpdate.error.message, details: resUpdate.error.details });
        }
        summary.updated += 1;
      }
    }

    if (toArchive.length) {
      const resArchive = await supaServer
        .from('menu_items')
        .update({ archived_at: new Date().toISOString() })
        .in(
          'id',
          toArchive.map((i) => i.id)
        )
        .eq('restaurant_id', restaurantId);
      if (resArchive.error) {
        return res.status(500).json({ ok: false, message: resArchive.error.message, details: resArchive.error.details });
      }
      summary.archived = toArchive.length;
    }

    return res.status(200).json({ ok: true, mode, ...summary });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err?.message || 'Failed to process CSV' });
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ ok: false, message: 'Method not allowed' });
}
