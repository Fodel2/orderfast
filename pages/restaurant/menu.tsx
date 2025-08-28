import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { Search, ChevronUp } from "lucide-react";
import { supabase } from '@/lib/supabaseClient';
import MenuItemCard from "../../components/MenuItemCard";
import { useCart } from "../../context/CartContext";
import CustomerLayout from "../../components/CustomerLayout";
import { useBrand } from "../../components/branding/BrandProvider";
import Skeleton from '@/components/ui/Skeleton';
import MenuHeader from '@/components/customer/menu/MenuHeader';
import { useRestaurant } from '@/lib/restaurant-context';

function readableText(hex?: string | null) {
  if (!hex) return '#fff';
  const h = hex.replace('#', '');
  const r = parseInt(h.length === 3 ? h[0] + h[0] : h.slice(0, 2), 16);
  const g = parseInt(h.length === 3 ? h[1] + h[1] : h.slice(2, 4), 16);
  const b = parseInt(h.length === 3 ? h[2] + h[2] : h.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 145 ? '#000' : '#fff';
}



interface Restaurant {
  id: string | number;
  name: string;
  website_title?: string | null;
  logo_url: string | null;
  logo_shape?: string | null;
  website_description: string | null;
  menu_description: string | null;
  menu_header_image_url?: string | null;
  menu_header_focal_x?: number | null;
  menu_header_focal_y?: number | null;
  menu_header_image_updated_at?: string | null;
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

export default function RestaurantMenuPage({ initialBrand }: { initialBrand: any | null }) {
  const router = useRouter();
  const brand = useBrand();
  const [routerReady, setRouterReady] = useState(false);
  useEffect(() => { if (router?.isReady) setRouterReady(true); }, [router?.isReady]);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(initialBrand);
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
  const { restaurantId, loading: ridLoading } = useRestaurant();

  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!routerReady || ridLoading || !restaurantId) return;

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
        .is('archived_at', null)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });

      const { data: itemData, error: itemErr } = await supabase
        .from('menu_items')
        .select(
          'id,name,description,price,image_url,is_vegetarian,is_vegan,is_18_plus,available,out_of_stock_until,sort_order,stock_status,stock_return_date,category_id'
        )
        .eq('restaurant_id', restaurantId)
        .is('archived_at', null)
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
            `item_id, addon_groups!inner(
              id,name,multiple_choice,required,max_group_select,max_option_quantity,
              addon_options!inner(id,name,price,is_vegetarian,is_vegan,is_18_plus,image_url)
            )`
          )
          .in('item_id', liveItemIds)
          .is('addon_groups.archived_at', null)
          .is('addon_groups.addon_options.archived_at', null);
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
  }, [routerReady, ridLoading, restaurantId]);


  const Inner = () => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const [activeCat, setActiveCat] = useState<string | undefined>(undefined);
    const sectionsRef = useRef<Record<string, HTMLElement | null>>({});
    const qp = router?.query || {};
    const headerImg =
      restaurant?.menu_header_image_url
        ? `${restaurant.menu_header_image_url}${
            restaurant.menu_header_image_updated_at
              ? `?v=${new Date(restaurant.menu_header_image_updated_at).getTime()}`
              : ''
          }`
        : '';
    const headerFocalX = restaurant?.menu_header_focal_x ?? 0.5;
    const headerFocalY = restaurant?.menu_header_focal_y ?? 0.5;

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


    return (
      <div className="px-4 sm:px-6 pb-28 max-w-6xl mx-auto">
        <div className="pt-4 space-y-8 scroll-smooth">
          {/* Inline guards rendered inside layout */}
          {!routerReady || ridLoading ? (
            <div className="p-6" />
          ) : !restaurantId ? (
            <div className="p-6 text-center text-red-500">No restaurant specified</div>
          ) : !restaurant ? (
            <div className="p-6">
              <Skeleton className="h-24 rounded-lg mb-4" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Skeleton className="h-36 rounded-lg" />
                <Skeleton className="h-36 rounded-lg" />
                <Skeleton className="h-36 rounded-lg" />
              </div>
            </div>
          ) : null}

          {/* Menu header hero */}
          {(() => {
            const menuTitle = restaurant?.website_title || restaurant?.name || 'Restaurant';
            return (
              <MenuHeader
                title={menuTitle}
                imageUrl={headerImg || undefined}
                accentHex={(brand?.brand as string) || undefined}
                focalX={headerFocalX}
                focalY={headerFocalY}
              />
            );
          })()}
          {(() => {
            const desc =
              restaurant?.menu_description ||
              restaurant?.website_description ||
              '';
            return desc ? (
              <p className="mt-3 text-[15px] leading-6 text-neutral-700 dark:text-neutral-300">{desc}</p>
            ) : null;
          })()}

          <div className="relative">
            <div className="relative">
              <input
                type="text"
                placeholder="Search menu..."
                value={tempQuery}
                onChange={(e) => setTempQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setSearchQuery(tempQuery)}
                className="w-full rounded-full bg-white/50 backdrop-blur-md shadow px-12 py-3 text-base placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-70">
                <Search className="w-5 h-5" />
              </span>
            </div>
          </div>

          {/* sticky category chips */}
          {Array.isArray(categories) && categories.length > 0 && (
            <div
              className={`sticky top-[60px] z-20 pt-2 pb-3 bg-white/70 backdrop-blur supports-[backdrop-filter]:backdrop-blur rounded-b-xl transition-all duration-400 ease-out will-change-transform will-change-opacity ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}`}
              style={{ transitionDelay: '100ms' }}
            >
              <div className="flex gap-3 overflow-x-auto no-scrollbar py-2">
                {categories.map((c: any) => {
                  const isActive = activeCat === String(c.id);
                  const cls = isActive
                    ? 'rounded-full px-5 py-2 text-sm font-semibold shadow-sm text-white'
                    : 'rounded-full bg-white/40 backdrop-blur px-4 py-2 text-sm font-medium hover:bg-white/60 transition';
                  return (
                    <button
                      key={c.id}
                      onClick={() => onChipSelect(c)}
                      className={cls}
                      aria-pressed={isActive}
                      aria-current={isActive ? 'true' : undefined}
                      style={isActive ? { backgroundColor: 'var(--brand-primary)' } : undefined}
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
                  >
                    {(() => {
                      const isActive = activeCat === String(cat.id);
                      return (
                        <div className="mt-8 mb-3">
                          <h2
                            className="text-xl font-semibold tracking-tight pb-1 border-b-2"
                            style={{
                              borderColor: isActive
                                ? 'var(--brand-secondary, var(--brand-primary))'
                                : 'var(--brand-primary)',
                            }}
                          >
                            {cat.name}
                          </h2>
                        </div>
                      );
                    })()}
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
      <CustomerLayout cartCount={itemCount}>
        <Inner />
      </CustomerLayout>
  );
}

import { supaServer } from '@/lib/supaServer';
import type { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async ctx => {
  const pick = (v: any) => (Array.isArray(v) ? v[0] : v);
  const id =
    (pick(ctx.query.restaurant_id) as string) ||
    (pick(ctx.query.id) as string) ||
    (pick(ctx.query.r) as string) ||
    null;
  let initialBrand = null;
  if (id) {
    const { data } = await supaServer()
      .from('restaurants')
      .select('id,website_title,name,logo_url,logo_shape,brand_primary_color,brand_secondary_color')
      .eq('id', id)
      .maybeSingle();
    initialBrand = data;
  }
  return {
    props: { initialBrand },
  };
};
