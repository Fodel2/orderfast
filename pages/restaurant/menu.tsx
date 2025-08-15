import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { Search, ChevronUp } from "lucide-react";
import { supabase } from "../../utils/supabaseClient";
import MenuItemCard from "../../components/MenuItemCard";
import { useCart } from "../../context/CartContext";
import CustomerLayout from "../../components/CustomerLayout";
import { useBrand } from "../../components/branding/BrandProvider";
import MenuHeader from '@/components/customer/menu/MenuHeader';
import resolveRestaurantId from '@/lib/resolveRestaurantId';

function getIdFromQuery(router: any): string | undefined {
  const qp = (router?.query ?? {}) as Record<string, unknown>;
  const pick = (v: unknown) => (Array.isArray(v) ? v[0] : v);
  const raw =
    pick(qp['restaurant_id']) ||
    pick(qp['id']) ||
    pick(qp['r']) ||
    undefined;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : undefined;
}


interface Restaurant {
  id: string | number;
  name: string;
  logo_url: string | null;
  website_description: string | null;
}

interface Category {
  id: number;
  name: string;
  description: string | null;
  sort_order: number;
  restaurant_id: number;
  image_url?: string | null;
}

interface Item {
  id: number;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_vegan: boolean | null;
  is_vegetarian: boolean | null;
  is_18_plus: boolean | null;
  available?: boolean | null;
  stock_status: 'in_stock' | 'scheduled' | 'out' | null;
  out_of_stock_until?: string | null;
  stock_return_date?: string | null;
  category_id: number | null;
  addon_groups?: any[];
}

export default function RestaurantMenuPage() {
  const router = useRouter();
  const brand = useBrand();
  const [routerReady, setRouterReady] = useState(false);
  useEffect(() => { if (router?.isReady) setRouterReady(true); }, [router?.isReady]);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [itemLinks, setItemLinks] = useState<
    { item_id: number; category_id: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [tempQuery, setTempQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTop, setShowTop] = useState(false);
  const { cart } = useCart();
  const itemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);
  const idFromResolver = typeof resolveRestaurantId === 'function'
    ? resolveRestaurantId(router, brand, restaurant)
    : undefined;
  const idFromQuery = getIdFromQuery(router);
  const restaurantId = idFromResolver || idFromQuery;

  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!routerReady || !restaurantId) return;

    const load = async () => {
      console.log(
        'Loading menu for',
        restaurantId,
        'subdomain',
        router.query.subdomain
      );
      const restRes = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId)
        .maybeSingle();

      const { data: catData, error: catErr } = await supabase
        .from('menu_categories')
        .select('id,name,description,image_url,sort_order,restaurant_id')
        .eq('restaurant_id', restaurantId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });

      const { data: itemData, error: itemErr } = await supabase
        .from('menu_items')
        .select(
          'id,name,description,price,image_url,is_vegetarian,is_vegan,is_18_plus,available,out_of_stock_until,sort_order,stock_status,stock_return_date,category_id'
        )
        .eq('restaurant_id', restaurantId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });

      const liveItemIds = (itemData || []).map((r: any) => r.id);
      let linkData: any[] = [];
      let addonRows: any[] = [];
      if (liveItemIds.length > 0) {
        const { data: icData, error: icErr } = await supabase
          .from('menu_item_categories')
          .select('item_id,category_id')
          .in('item_id', liveItemIds);
        if (icErr) console.error('Failed to fetch item categories', icErr);
        linkData = icData || [];

        const { data: addData, error: addonErr } = await supabase
          .from('item_addon_links')
          .select(
            'item_id, addon_groups(id,name,multiple_choice,required,max_group_select,max_option_quantity, addon_options(id,name,price,is_vegetarian,is_vegan,is_18_plus,image_url))'
          )
          .in('item_id', liveItemIds);
        if (addonErr) console.error('Failed to fetch addons', addonErr);
        addonRows = addData || [];
      }

      const addonMap: Record<number, any[]> = {};
      addonRows.forEach((row) => {
        const arr = addonMap[row.item_id] || [];
        if (row.addon_groups) arr.push(row.addon_groups);
        addonMap[row.item_id] = arr;
      });
      const itemsWithAddons = (itemData || []).map((it: any) => ({
        ...it,
        addon_groups: addonMap[it.id] || [],
      }));

      if (restRes.error)
        console.error('Failed to fetch restaurant', restRes.error);
      if (catErr) console.error('Failed to fetch categories', catErr);
      if (itemErr) console.error('Failed to fetch items', itemErr);

      if (process.env.NODE_ENV === 'development') {
        console.debug('[customer:menu]', {
          rid: restaurantId,
          cats: catData?.length || 0,
          items: itemData?.length || 0,
        });
      }

      setRestaurant(restRes.data as Restaurant | null);
      setCategories(catData || []);
      setItems(itemsWithAddons);
      setItemLinks(linkData);

      if (process.env.NODE_ENV === 'development') {
        console.debug('[customer:menu]', {
          rid: restaurantId,
          cats: catData?.length || 0,
          items: itemData?.length || 0,
        });
      }
      setLoading(false);
    };

    load();
  }, [routerReady, restaurantId]);


  const Inner = () => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const [activeCat, setActiveCat] = useState<string | undefined>(undefined);
    const sectionsRef = useRef<Record<string, HTMLElement | null>>({});
    const qp = router?.query || {};
    const headerImg =
      (
        restaurant &&
          typeof restaurant === 'object' &&
          'header_image' in (restaurant as any) &&
          typeof (restaurant as any).header_image === 'string' &&
          (restaurant as any).header_image.length > 0
          ? ((restaurant as any).header_image as string)
          : ''
      ) ||
      (
        restaurant &&
          typeof restaurant === 'object' &&
          'hero_image' in (restaurant as any) &&
          typeof (restaurant as any).hero_image === 'string' &&
          (restaurant as any).hero_image.length > 0
          ? ((restaurant as any).hero_image as string)
          : ''
      ) ||
      (typeof (qp as any).header === 'string' ? ((qp as any).header as string) : '') ||
      '';

    useEffect(() => {
      if (!Array.isArray(categories) || categories.length === 0) return;
      const obs = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          const id = visible?.target?.getAttribute('data-cat-id');
          if (id) setActiveCat(id);
        },
        { root: null, rootMargin: '-64px 0px -70% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
      );
      categories.forEach((c: any) => {
        const el = sectionsRef.current[c.id];
        if (el) obs.observe(el);
      });
      return () => obs.disconnect();
    }, [Array.isArray(categories) ? categories.length : 0]);

    function onChipSelect(c: any) {
      const id = c?.id ? `cat-${c.id}` : '';
      const el = id ? document.getElementById(id) : null;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    type CSSVars = React.CSSProperties & Record<string, string | number>;

    return (
      <div className="px-4 pb-28 max-w-6xl mx-auto">
        <div className="pt-4 space-y-8 scroll-smooth">
          {/* Inline guards rendered inside layout */}
          {!routerReady ? (
            <div className="p-6" />
          ) : !restaurantId ? (
            <div className="p-6 text-center text-red-500">No restaurant specified</div>
          ) : !restaurant ? (
            <div className="p-6">
              <div className="h-24 bg-gray-100 rounded-lg mb-4 animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="h-36 bg-gray-100 rounded-lg animate-pulse" />
                <div className="h-36 bg-gray-100 rounded-lg animate-pulse" />
                <div className="h-36 bg-gray-100 rounded-lg animate-pulse" />
              </div>
            </div>
          ) : null}

          {/* Menu header hero */}
          <MenuHeader
            title={restaurant?.name || 'Restaurant'}
            subtitle={restaurant?.website_description ?? null}
            imageUrl={headerImg || undefined}
            logoUrl={restaurant?.logo_url ?? null}
            accentHex={(brand?.brand as string) || undefined}
          />
          {restaurant?.website_description && (
            <p className="text-gray-600 text-center">{restaurant.website_description}</p>
          )}

          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search menu..."
                value={tempQuery}
                onChange={(e) => setTempQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setSearchQuery(tempQuery)}
                className="w-full rounded-full border bg-white pl-10 pr-4 h-9 text-sm shadow-md focus:outline-none focus:ring"
              />
            </div>
          </div>

          {/* sticky category chips */}
          {Array.isArray(categories) && categories.length > 0 && (
            <div
              className={`sticky top-[60px] z-20 pt-2 pb-3 bg-white/70 backdrop-blur supports-[backdrop-filter]:backdrop-blur rounded-b-xl transition-all duration-400 ease-out will-change-transform will-change-opacity ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}`}
              style={{ transitionDelay: '100ms' }}
            >
              <div className="flex gap-3 overflow-x-auto no-scrollbar">
                {categories.map((c: any) => {
                  const isActive = activeCat === String(c.id);
                  const chipStyle: CSSVars = isActive
                    ? {
                        ['--tw-ring-color']: String(brand?.brand || 'currentColor'),
                        backgroundColor: String(brand?.brand || ''),
                        borderColor: String(brand?.brand || ''),
                      }
                    : {
                        ['--tw-ring-color']: String(brand?.brand || 'currentColor'),
                      };
                  return (
                    <button
                      key={c.id}
                      onClick={() => onChipSelect(c)}
                      className={`px-4 py-2 rounded-full border whitespace-nowrap transition-transform duration-200 ease-out hover:scale-[1.03] active:scale-95 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                        activeCat === String(c.id)
                          ? 'scale-105 text-white'
                          : 'bg-gray-100 border-gray-200 text-gray-700'
                      }`}
                      aria-pressed={activeCat === String(c.id)}
                      aria-current={activeCat === String(c.id) ? 'true' : undefined}
                      style={chipStyle}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-8">
            {categories.length === 0 ? (
              <p className="text-center text-gray-500">This menu is currently empty.</p>
            ) : (
              categories.map((cat) => {
                const catItems = items.filter(
                  (it) =>
                    (it.category_id === cat.id ||
                      itemLinks.some(
                        (link) => link.item_id === it.id && link.category_id === cat.id,
                      )) &&
                    (!searchQuery ||
                      it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (it.description || '')
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase())),
                );
                if (catItems.length === 0) return null;
                return (
                  <section
                    key={cat.id}
                    id={`cat-${cat.id}`}
                    data-cat-id={cat.id}
                    ref={(el) => (sectionsRef.current[cat.id] = el)}
                    style={{ scrollMarginTop: 76 }}
                    className="space-y-4"
                  >
                    <h2 className="text-xl font-semibold text-left">{cat.name}</h2>
                    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                        {catItems.map((item, idx) => (
                          <div
                            key={item.id}
                            className={`opacity-0 translate-y-2 transition-all duration-500 ease-out will-change-transform will-change-opacity ${mounted ? 'opacity-100 translate-y-0' : ''}`}
                            style={{ transitionDelay: `${idx * 75}ms` }}
                          >
                            <MenuItemCard item={item} restaurantId={restaurantId as string} />
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })
              )}
          </div>
          {showTop && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="fixed bottom-6 right-4 z-50 bg-white shadow-lg rounded-full w-10 h-10 flex items-center justify-center transition"
            >
              <ChevronUp className="w-5 h-5" />
            </motion.button>
          )}
        </div>
      </div>
    );
  };

  return (
    <CustomerLayout cartCount={itemCount} restaurant={restaurant}>
      <Inner />
    </CustomerLayout>
  );
}

export async function getStaticProps() {
  return {
    props: {
      customerMode: true,
      cartCount: 0,
    },
  };
}
