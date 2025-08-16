/** @jest-environment node */
import { createMocks } from 'node-mocks-http';
import draftHandler from '../pages/api/menu-builder';
import publishHandler from '../pages/api/publish-menu';
import { getServerClient } from '../lib/supaServer';

describe('menu builder API', () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    test.skip('Supabase env not configured', () => {});
    return;
  }

  test('upsert draft then publish', async () => {
    const supa = getServerClient();
    const { data: restaurant } = await supa
      .from('restaurants')
      .insert({ name: 'Test R' })
      .select('id')
      .single();
    const rid = restaurant!.id;

    const { data: group } = await supa
      .from('addon_groups')
      .insert({ name: 'Test', restaurant_id: rid })
      .select('id')
      .single();
    const gid = group?.id;

    const payload = {
      categories: [
        { id: 'c1', name: 'Cat1', sort_order: 1 },
        { id: 'c2', name: 'Cat2', sort_order: 2 },
      ],
      items: [
        { id: 'i1', name: 'Item1', price: 1, sort_order: 1, category_id: 'c1', addons: [] },
        {
          id: 'i2',
          name: 'Item2',
          price: 2,
          sort_order: 2,
          category_id: 'c2',
          addons: gid ? [gid] : [],
        },
      ],
    };
    let { req, res } = createMocks({
      method: 'PUT',
      body: { restaurantId: rid, payload },
    });
    await draftHandler(req, res);
    expect(res._getStatusCode()).toBe(200);

    ({ req, res } = createMocks({ method: 'POST', body: { restaurantId: rid } }));
    await publishHandler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.itemsInserted).toBeGreaterThan(0);
    expect(data.categoriesInserted).toBeGreaterThan(0);
    expect(data.linksInserted).toBeGreaterThan(0);
  });
});

