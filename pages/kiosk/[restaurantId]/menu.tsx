import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import MenuItemCard from '@/components/MenuItemCard';
import KioskLayout from '@/components/layouts/KioskLayout';
import { supabase } from '@/lib/supabaseClient';
import { ITEM_ADDON_LINK_WITH_GROUPS_SELECT } from '@/lib/queries/addons';
import Skeleton from '@/components/ui/Skeleton';
import { useCart } from '@/context/CartContext';

type Category = {
  id: number;
  name: string;
  description: string | null;
};

type Item = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_vegetarian: boolean | null;
  is_vegan: boolean | null;
  is_18_plus: boolean | null;
  stock_status: 'in_stock' | 'scheduled' | 'out' | null;
  available?: boolean | null;
  category_id?: number | null;
  addon_groups?: any[];
};

type ItemLink = { item_id: number; category_id: number };

type Restaurant = {
  id: string;
  name: string;
  website_title?: string | null;
  website_description?: string | null;
  logo_url?: string | null;
};

export default function KioskMenuPage() {
  const router = useRouter();
  const { restaurantId: routeParam } = router.query;
  const restaurantId = Array.isArray(routeParam) ? routeParam[0] : routeParam;
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [itemLinks, setItemLinks] = useState<ItemLink[]>([]);
  const [loading, setLoading] = useState(true);
  const { cart } = useCart();
  const cartCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    let active = true;

    const load = async () => {
      setLoading(true);

      try {
        const restPromise = supabase
          .from('restaurants')
          .select('id,name,website_title,website_description,logo_url')
          .eq('id', restaurantId)
          .maybeSingle();

        const categoriesPromise = supabase
          .from('menu_categories')
          .select('id,name,description,sort_order')
          .eq('restaurant_id', restaurantId)
          .is('archived_at', null)
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('name', { ascending: true });

        const itemsPromise = supabase
          .from('menu_items')
          .select(
            'id,name,description,price,image_url,is_vegetarian,is_vegan,is_18_plus,stock_status,category_id,available'
          )
          .eq('restaurant_id', restaurantId)
          .is('archived_at', null)
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('name', { ascending: true });

        const [restRes, catRes, itemRes] = await Promise.all([restPromise, categoriesPromise, itemsPromise]);

        if (!active) return;

        if (restRes.data) {
          setRestaurant(restRes.data as Restaurant);
        } else {
          setRestaurant(null);
        }

        if (restRes.error) console.error('[kiosk] failed to fetch restaurant', restRes.error);
        if (catRes.error) console.error('[kiosk] failed to fetch categories', catRes.error);
        if (itemRes.error) console.error('[kiosk] failed to fetch items', itemRes.error);

        const liveItems = (itemRes.data || []).filter((it: any) => it?.available !== false);
        const liveItemIds = liveItems.map((row) => row.id);
        let linkRows: ItemLink[] = [];
        let addonRows: any[] = [];

        if (liveItemIds.length > 0) {
          const [{ data: links }, { data: addons }] = await Promise.all([
            supabase
              .from('menu_item_categories')
              .select('item_id,category_id')
              .in('item_id', liveItemIds),
            supabase
              .from('item_addon_links')
              .select(ITEM_ADDON_LINK_WITH_GROUPS_SELECT)
              .in('item_id', liveItemIds)
              .is('addon_groups.archived_at', null)
              .is('addon_groups.addon_options.archived_at', null),
          ]);

          if (!active) return;

          linkRows = (links || []) as ItemLink[];
          addonRows = addons || [];
        }

        const addonMap: Record<number, any[]> = {};
        addonRows.forEach((row) => {
          if (!row?.item_id) return;
          const groups = Array.isArray(row?.addon_groups?.addon_options)
            ? [
                {
                  ...row.addon_groups,
                  addon_options: row.addon_groups.addon_options.filter(
                    (opt: any) => opt?.archived_at == null && opt?.available !== false
                  ),
                },
              ]
            : row?.addon_groups
            ? [row.addon_groups]
            : [];
          addonMap[row.item_id] = [...(addonMap[row.item_id] || []), ...groups];
        });

        const itemsWithAddons = liveItems.map((item: any) => ({
          ...item,
          addon_groups: addonMap[item.id] || [],
        }));

        setCategories((catRes.data as Category[]) || []);
        setItems(itemsWithAddons as Item[]);
        setItemLinks(linkRows);
      } catch (error) {
        console.error('[kiosk] failed to load menu', error);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [restaurantId]);

  const categorizedItems = useMemo(() => {
    if (!categories.length) return [];
    return categories
      .map((category) => {
        const catItems = items.filter(
          (item) =>
            item.category_id === category.id ||
            itemLinks.some((link) => link.category_id === category.id && link.item_id === item.id)
        );
        return { ...category, items: catItems };
      })
      .filter((category) => category.items.length > 0);
  }, [categories, itemLinks, items]);

  const uncategorizedItems = useMemo(() => {
    if (!items.length) return [];
    const linkedIds = new Set(itemLinks.map((link) => link.item_id));
    items.forEach((menuItem) => {
      if (menuItem?.category_id) {
        linkedIds.add(menuItem.id);
      }
    });
    return items.filter((item) => !linkedIds.has(item.id));
  }, [itemLinks, items]);

  const title = restaurant?.website_title || restaurant?.name || 'Restaurant';
  const subtitle = restaurant?.website_description || undefined;

  const hasCategoryItems = categorizedItems.length > 0;
  const hasUncategorizedItems = uncategorizedItems.length > 0;

  return (
    <KioskLayout
      title={title}
      subtitle={subtitle}
      action={
        restaurantId ? (
          <Link
            href={`/kiosk/${restaurantId}/cart`}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow transition hover:bg-white/90"
          >
            View cart ({cartCount})
          </Link>
        ) : null
      }
    >
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : !restaurantId ? (
        <div className="rounded-2xl bg-white/10 p-6 text-center text-sm font-semibold uppercase tracking-[0.2em] text-red-200">
          Missing restaurant ID
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {categorizedItems.map((category) => (
            <section key={category.id} className="flex flex-col gap-4">
              <header className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold tracking-tight text-white">{category.name}</h2>
                {category.description ? (
                  <p className="text-sm text-white/70">{category.description}</p>
                ) : null}
              </header>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {category.items.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    restaurant={restaurant}
                    restaurantLogoUrl={restaurant?.logo_url ?? null}
                    mode="kiosk"
                  />
                ))}
              </div>
            </section>
          ))}

          {hasUncategorizedItems ? (
            <section className="flex flex-col gap-4">
              <header>
                <h2 className="text-2xl font-semibold tracking-tight text-white">Other items</h2>
              </header>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {uncategorizedItems.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    restaurant={restaurant}
                    restaurantLogoUrl={restaurant?.logo_url ?? null}
                    mode="kiosk"
                  />
                ))}
              </div>
            </section>
          ) : null}

          {!hasCategoryItems && !hasUncategorizedItems ? (
            <div className="rounded-2xl border border-dashed border-white/20 p-8 text-center text-white/70">
              This menu is currently empty.
            </div>
          ) : null}
        </div>
      )}
    </KioskLayout>
  );
}
