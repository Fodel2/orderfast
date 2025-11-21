import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import MenuItemCard from '@/components/MenuItemCard';
import KioskLayout from '@/components/layouts/KioskLayout';
import { supabase } from '@/lib/supabaseClient';
import { ITEM_ADDON_LINK_WITH_GROUPS_SELECT } from '@/lib/queries/addons';
import Skeleton from '@/components/ui/Skeleton';
import { useCart } from '@/context/CartContext';
import KioskCategories from '@/components/kiosk/KioskCategories';
import { KIOSK_CATEGORY_BAR_HEIGHT, KIOSK_HEADER_FULL_HEIGHT } from '@/components/kiosk/kioskHeaderConstants';

type Category = {
  id: number;
  name: string;
  description: string | null;
  image_url?: string | null;
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
  theme_primary_color?: string | null;
  menu_header_image_url?: string | null;
  menu_header_image_updated_at?: string | null;
  menu_header_focal_x?: number | null;
  menu_header_focal_y?: number | null;
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
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const activeCategoryRef = useRef<number | null>(null);
  const lastScrollTargetRef = useRef<number | null>(null);
  const { cart } = useCart();
  const cartCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);
  const chromeOffset = KIOSK_HEADER_FULL_HEIGHT + KIOSK_CATEGORY_BAR_HEIGHT;

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
          .select(
            'id,name,website_title,website_description,logo_url,theme_primary_color,menu_header_image_url,menu_header_image_updated_at,menu_header_focal_x,menu_header_focal_y'
          )
          .eq('id', restaurantId)
          .maybeSingle();

        const categoriesPromise = supabase
          .from('menu_categories')
          .select('id,name,description,sort_order,image_url')
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

  const hasCategoryItems = categorizedItems.length > 0;
  const hasUncategorizedItems = uncategorizedItems.length > 0;

  const handleCategorySelect = useCallback(
    (categoryId: number) => {
      if (categoryId === lastScrollTargetRef.current) return;
      setActiveCategoryId(categoryId);

      const el = document.getElementById(`cat-${categoryId}`);
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const target = window.scrollY + rect.top - chromeOffset;

      lastScrollTargetRef.current = categoryId;
      window.scrollTo({ top: Math.max(target, 0), behavior: 'smooth' });
    },
    [chromeOffset]
  );

  useEffect(() => {
    activeCategoryRef.current = activeCategoryId;
  }, [activeCategoryId]);

  useEffect(() => {
    if (categorizedItems.length === 0) return;
    if (activeCategoryRef.current !== null) return;
    setActiveCategoryId(categorizedItems[0].id);
  }, [categorizedItems]);

  useEffect(() => {
    if (!categorizedItems.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => {
            if (b.intersectionRatio !== a.intersectionRatio) {
              return b.intersectionRatio - a.intersectionRatio;
            }
            return a.boundingClientRect.top - b.boundingClientRect.top;
          });

        const topEntry = visibleEntries[0];
        if (!topEntry) return;

        const targetId = Number(topEntry.target.getAttribute('data-category-id'));
        if (Number.isNaN(targetId)) return;

        if (activeCategoryRef.current !== targetId) {
          setActiveCategoryId(targetId);
        }
      },
      {
        root: null,
        rootMargin: `-${chromeOffset}px 0px -55% 0px`,
        threshold: [0.25, 0.5, 0.75, 1],
      }
    );

    const sections = categorizedItems
      .map((category) => document.getElementById(`cat-${category.id}`))
      .filter((el): el is HTMLElement => Boolean(el));

    sections.forEach((section) => {
      section.setAttribute('data-category-id', section.id.replace('cat-', ''));
      observer.observe(section);
    });

    return () => {
      observer.disconnect();
    };
  }, [categorizedItems, chromeOffset]);

  return (
    <KioskLayout
      restaurantId={restaurantId}
      restaurant={restaurant}
      cartCount={cartCount}
      categoryBar={
        categorizedItems.length ? (
          <div className="w-full border-b border-neutral-200 bg-white px-4 sm:px-8">
            <KioskCategories
              categories={categorizedItems}
              activeCategoryId={activeCategoryId}
              onSelect={handleCategorySelect}
            />
          </div>
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
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
          Missing restaurant ID
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {categorizedItems.map((category) => (
            <section
              key={category.id}
              id={`cat-${category.id}`}
              className="flex flex-col gap-4"
              style={{ scrollMarginTop: `${chromeOffset}px` }}
            >
              <header className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">{category.name}</h2>
                {category.description ? (
                  <p className="text-sm text-neutral-600">{category.description}</p>
                ) : null}
              </header>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {category.items.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    restaurantId={restaurantId}
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
                <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Other items</h2>
              </header>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {uncategorizedItems.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    restaurantId={restaurantId}
                    restaurantLogoUrl={restaurant?.logo_url ?? null}
                    mode="kiosk"
                  />
                ))}
              </div>
            </section>
          ) : null}

          {!hasCategoryItems && !hasUncategorizedItems ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-neutral-600">
              This menu is currently empty.
            </div>
          ) : null}
        </div>
      )}
    </KioskLayout>
  );
}
