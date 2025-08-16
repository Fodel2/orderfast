/** @jest-environment node */
import { createMocks } from 'node-mocks-http';
import menuHandler from '../pages/api/menu-builder';
import publishHandler from '../pages/api/publish-menu';
import { supaServer } from '../lib/supaServer';

describe('menu builder API', () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    test.skip('Supabase env not configured', () => {});
    return;
  }

  test('upsert draft then publish', async () => {
    const supa = supaServer();
    const { data: restaurant } = await supa
      .from('restaurants')
      .insert({ name: 'Test R' })
      .select('id')
      .single();
    const rid = restaurant!.id;
    const draft = {
      categories: [{ id: 'c1', name: 'Cat1', sort_order: 1 }],
      items: [{ id: 'i1', name: 'Item1', price: 1, sort_order: 1, category_id: 'c1' }],
    };
    let { req, res } = createMocks({
      method: 'PUT',
      body: { restaurantId: rid, draft },
    });
    await menuHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData()).ok).toBe(true);

    ({ req, res } = createMocks({ method: 'POST', body: { restaurantId: rid } }));
    await publishHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const result = JSON.parse(res._getData());
    expect(result.inserted.items).toBeGreaterThan(0);
    expect(result.inserted.categories).toBeGreaterThan(0);

    const { data: liveCats } = await supa
      .from('menu_categories')
      .select('name')
      .eq('restaurant_id', rid)
      .is('archived_at', null);
    const { data: liveItems } = await supa
      .from('menu_items')
      .select('name')
      .eq('restaurant_id', rid)
      .is('archived_at', null);
    expect((liveCats || []).map((c: any) => c.name).sort()).toEqual(['Cat1']);
    expect((liveItems || []).map((i: any) => i.name).sort()).toEqual(['Item1']);
  });
});

