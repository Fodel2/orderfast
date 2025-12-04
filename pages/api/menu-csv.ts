import { randomUUID } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { supaServer } from '@/lib/supaServer';

const isProd = process.env.NODE_ENV === 'production';

type CsvMode = 'import' | 'bulk';

type RowInput = {
  name?: string;
  price?: string | number;
  category?: string;
  description?: string;
  tags?: string;
};

type ItemUpdate = {
  id?: string | number;
  data: Record<string, any>;
};

const TAG_FIELDS: Record<string, keyof any> = {
  vegan: 'is_vegan',
  vegetarian: 'is_vegetarian',
  '18_plus': 'is_18_plus',
  '18+': 'is_18_plus',
  '18-plus': 'is_18_plus',
};

function normalizeTag(input: string) {
  const lowered = input.trim().toLowerCase();
  return lowered.replace(/\s+/g, '_').replace(/-/g, '_');
}

function resolveRestaurantId(req: NextApiRequest): string | undefined {
  const body = (req.body || {}) as any;
  const q =
    (typeof req.query.restaurant_id === 'string' && req.query.restaurant_id) ||
    (typeof req.query.rid === 'string' && req.query.rid) ||
    (typeof body.restaurantId === 'string' && body.restaurantId) ||
    (typeof body.restaurantId === 'number' && String(body.restaurantId)) ||
    undefined;
  if (q) return q;
  if (!isProd) return process.env.NEXT_PUBLIC_DEMO_RESTAURANT_ID;
  return undefined;
}

function validateRows(rows: RowInput[]) {
  const errors: Array<{ index: number; message: string }> = [];
  const parsed = rows.map((row, idx) => {
    const name = (row.name || '').toString().trim();
    const category = (row.category || '').toString().trim();
    const priceNum = Number(row.price);
    if (!name) errors.push({ index: idx, message: 'Name is required' });
    if (!category) errors.push({ index: idx, message: 'Category is required' });
    if (!row.price || Number.isNaN(priceNum) || priceNum <= 0) {
      errors.push({ index: idx, message: 'Price must be greater than 0' });
    }
    const tags = (row.tags || '')
      .toString()
      .split(/[,|]/)
      .map((t) => normalizeTag(t))
      .filter(Boolean);
    const invalid = tags.filter((t) => !TAG_FIELDS[t]);
    if (invalid.length) {
      errors.push({ index: idx, message: `Unsupported tags: ${invalid.join(', ')}` });
    }
    return { name, category, price: priceNum, description: row.description || '', tags };
  });
  return { errors, parsed };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const restaurantId = resolveRestaurantId(req);
  if (!restaurantId) {
    return res.status(400).json({ error: 'restaurantId is required' });
  }

  const { mode, rows, confirmArchive } = (req.body || {}) as {
    mode?: CsvMode;
    rows?: RowInput[];
    confirmArchive?: boolean;
  };

  if (!mode || (mode !== 'import' && mode !== 'bulk')) {
    return res.status(400).json({ error: 'mode must be import or bulk' });
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'rows are required' });
  }

  const { errors, parsed } = validateRows(rows);
  if (errors.length) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  const supabase = supaServer;

  const { data: categories, error: catError } = await supabase
    .from('menu_categories')
    .select('id,name,sort_order,archived_at')
    .eq('restaurant_id', restaurantId)
    .is('archived_at', null);
  if (catError) {
    return res.status(500).json({ error: catError.message, details: catError.details });
  }

  const { data: items, error: itemsError } = await supabase
    .from('menu_items')
    .select('id,name,category_id,archived_at,is_vegan,is_vegetarian,is_18_plus,price,description')
    .eq('restaurant_id', restaurantId)
    .is('archived_at', null);
  if (itemsError) {
    return res.status(500).json({ error: itemsError.message, details: itemsError.details });
  }

  const categoryMap = new Map<string, { id: string | number; sort_order?: number }>();
  categories?.forEach((c) => {
    categoryMap.set((c.name || '').toLowerCase(), c as any);
  });
  let nextSort = Math.max(0, ...(categories || []).map((c: any) => c.sort_order || 0)) + 1;

  const ensureCategory = async (name: string) => {
    const key = name.toLowerCase();
    if (categoryMap.has(key)) return categoryMap.get(key)!.id;
    const insert = await supabase
      .from('menu_categories')
      .insert({ name, restaurant_id: restaurantId, sort_order: nextSort++ })
      .select('id')
      .single();
    if (insert.error) {
      throw insert.error;
    }
    const id = insert.data?.id;
    categoryMap.set(key, { id });
    return id;
  };

  const upserts: ItemUpdate[] = [];
  const inserts: Record<string, any>[] = [];

  const incomingNames = new Set<string>();
  for (const row of parsed) {
    incomingNames.add(row.name.toLowerCase());
    const categoryId = await ensureCategory(row.category);
    const tagFlags: Record<string, any> = {};
    row.tags.forEach((t) => {
      const field = TAG_FIELDS[t];
      if (field) tagFlags[field] = true;
    });
    const payload = {
      restaurant_id: restaurantId,
      name: row.name,
      category_id: categoryId,
      price: row.price,
      description: row.description || null,
      ...tagFlags,
    } as Record<string, any>;
    const existing = items?.find((i) => (i.name || '').toLowerCase() === row.name.toLowerCase());
    if (mode === 'bulk' && existing) {
      upserts.push({ id: existing.id, data: payload });
    } else {
      if (!payload.external_key) {
        payload.external_key = randomUUID();
      }
      inserts.push(payload);
    }
  }

  const toArchive =
    mode === 'bulk'
      ? (items || []).filter((i) => !incomingNames.has((i.name || '').toLowerCase()))
      : [];

  if (mode === 'bulk' && toArchive.length > 0 && !confirmArchive) {
    return res.status(400).json({
      error: 'Archive confirmation required',
      details: { archive: toArchive.length },
    });
  }

  const summary = { created: 0, updated: 0, archived: 0 };

  if (inserts.length) {
    const insertRes = await supabase.from('menu_items').insert(inserts);
    if (insertRes.error) {
      return res.status(500).json({ error: insertRes.error.message, details: insertRes.error.details });
    }
    summary.created = inserts.length;
  }

  if (upserts.length) {
    for (const entry of upserts) {
      const resUpdate = await supabase
        .from('menu_items')
        .update(entry.data)
        .eq('id', entry.id)
        .eq('restaurant_id', restaurantId);
      if (resUpdate.error) {
        return res.status(500).json({ error: resUpdate.error.message, details: resUpdate.error.details });
      }
      summary.updated += 1;
    }
  }

  if (toArchive.length) {
    const resArchive = await supabase
      .from('menu_items')
      .update({ archived_at: new Date().toISOString() })
      .in(
        'id',
        toArchive.map((i) => i.id)
      )
      .eq('restaurant_id', restaurantId);
    if (resArchive.error) {
      return res.status(500).json({ error: resArchive.error.message, details: resArchive.error.details });
    }
    summary.archived = toArchive.length;
  }

  return res.status(200).json({ message: 'CSV import applied', summary });
}

export default handler;
