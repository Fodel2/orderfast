import { randomUUID } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { supaServer } from '@/lib/supaServer';

const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'menu-images';

type MenuItemPayload = {
  itemId?: string | number | null;
  restaurantId?: string | number | null;
  name?: string;
  description?: string;
  price?: number;
  isVegan?: boolean;
  isVegetarian?: boolean;
  is18Plus?: boolean;
  categoryId?: number | null;
  categoryIds?: Array<string | number>;
  addonGroupIds?: Array<string | number>;
  externalKey?: string | null;
  imageDataUrl?: string | null;
  imageName?: string | null;
  existingImageUrl?: string | null;
};

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; contentType: string } | null {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) return null;
  const [, contentType, base64Data] = match;
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    return { buffer, contentType: contentType || 'application/octet-stream' };
  } catch {
    return null;
  }
}

async function uploadImage(
  restaurantId: string | number,
  imageDataUrl: string,
  imageName?: string | null
): Promise<string> {
  const parsed = dataUrlToBuffer(imageDataUrl);
  if (!parsed) {
    throw new Error('Invalid image data');
  }

  const extFromName = imageName?.includes('.') ? imageName.split('.').pop() || '' : '';
  const guessedExt = parsed.contentType.split('/').pop() || 'jpg';
  const extension = extFromName || guessedExt;
  const path = `restaurants/${restaurantId}/menu-items/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${extension}`;

  const { error: uploadError } = await supaServer.storage.from(STORAGE_BUCKET).upload(path, parsed.buffer, {
    upsert: true,
    contentType: parsed.contentType,
  });

  if (uploadError) {
    throw uploadError;
  }

  return supaServer.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function ensureExternalKey(itemId: string, fallbackKey?: string | null) {
  if (fallbackKey) return fallbackKey;

  const { data, error } = await supaServer
    .from('menu_items')
    .select('external_key')
    .eq('id', itemId)
    .maybeSingle();

  if (error) throw error;

  if (data?.external_key) return data.external_key as string;

  const generated = randomUUID();
  const { error: updateError } = await supaServer
    .from('menu_items')
    .update({ external_key: generated })
    .eq('id', itemId);

  if (updateError) throw updateError;
  return generated;
}

async function replaceAddonLinks(itemId: string, restaurantId: string, addonGroupIds: Array<string | number>) {
  const deleteFilters = [`item_id.eq.${itemId}`];

  const externalKey = await ensureExternalKey(itemId);
  if (externalKey) {
    deleteFilters.push(`item_external_key.eq.${externalKey}`);
  }

  const { error: deleteError } = await supaServer
    .from('item_addon_links_drafts')
    .delete()
    .eq('restaurant_id', restaurantId)
    .or(deleteFilters.join(','));

  if (deleteError) throw deleteError;

  if (!addonGroupIds.length) return;

  const unique = Array.from(new Set(addonGroupIds.map(String)));
  const rows = unique.map((groupId) => ({
    id: randomUUID(),
    restaurant_id: restaurantId,
    item_id: itemId,
    item_external_key: externalKey,
    group_id: groupId,
    state: 'draft',
  }));

  const { error: insertError } = await supaServer.from('item_addon_links_drafts').insert(rows);
  if (insertError) throw insertError;
}

async function saveMenuItem(body: MenuItemPayload) {
  const {
    itemId,
    restaurantId,
    name,
    description,
    price,
    isVegan,
    isVegetarian,
    is18Plus,
    categoryId,
    categoryIds,
    addonGroupIds,
    externalKey,
    imageDataUrl,
    imageName,
    existingImageUrl,
  } = body;

  if (!restaurantId) throw new Error('restaurantId is required');
  const rid = String(restaurantId);

  let finalImageUrl = existingImageUrl || null;
  if (imageDataUrl) {
    finalImageUrl = await uploadImage(rid, imageDataUrl, imageName);
  }

  const itemData: Record<string, any> = {
    restaurant_id: restaurantId,
    name,
    description,
    price,
    is_vegan: isVegan,
    is_vegetarian: isVegetarian,
    is_18_plus: is18Plus,
    image_url: finalImageUrl,
    category_id: categoryId ?? null,
  };

  if (externalKey) {
    itemData.external_key = externalKey;
  }

  const query = itemId
    ? supaServer.from('menu_items').update(itemData).eq('id', itemId).select().single()
    : supaServer.from('menu_items').insert([itemData]).select().single();

  const { data, error } = await query;
  if (error) throw error;
  const savedItemId = data?.id ? String(data.id) : itemId ? String(itemId) : null;
  if (!savedItemId) throw new Error('Unable to resolve saved item id');

  if (itemId) {
    const { error: deleteLinksError } = await supaServer
      .from('menu_item_categories')
      .delete()
      .eq('item_id', savedItemId);
    if (deleteLinksError) throw deleteLinksError;
  }

  if (Array.isArray(categoryIds) && categoryIds.length) {
    const rows = categoryIds.map((cid) => ({
      item_id: savedItemId,
      category_id: String(cid),
    }));
    const { error: catError } = await supaServer.from('menu_item_categories').insert(rows);
    if (catError) throw catError;
  }

  if (Array.isArray(addonGroupIds)) {
    await replaceAddonLinks(savedItemId, rid, addonGroupIds);
  }

  return data;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['POST', 'PUT'].includes(req.method || '')) {
    res.setHeader('Allow', ['POST', 'PUT']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const body = req.body as MenuItemPayload;
    const item = await saveMenuItem(body);
    return res.status(200).json({ item });
  } catch (err: any) {
    console.error('[menu-items] save failed', err);
    const message = err?.message || 'Failed to save item';
    return res.status(500).json({ error: message });
  }
}

