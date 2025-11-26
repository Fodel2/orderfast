import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { ChevronUp } from "lucide-react";
import { supabase } from '@/lib/supabaseClient';
import { ITEM_ADDON_LINK_WITH_GROUPS_SELECT } from '@/lib/queries/addons';
import MenuItemCard from "../../components/MenuItemCard";
import { useCart } from "../../context/CartContext";
import CustomerLayout from "../../components/CustomerLayout";
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
  const [routerReady, setRouterReady] = useState(false);
  useEffect(() => { if (router?.isReady) setRouterReady(true); }, [router?.isReady]);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(initialBrand);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [itemLinks, setItemLinks] = useState<
    { item_id: number; category_id: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [showTop, setShowTop] = useState(false);
  const { cart } = useCart();
  const itemCount = cart.items.reduce((sum, it) => sum + it.quantity, 0);
  const { restaurantId, loading: ridLoading } = useRestaurant();
  const effectiveRestaurantId = restaurantId || (initialBrand?.id ? String(initialBrand.id) : null);

  useEffect(() => {
    if (!routerReady || ridLoading || !effectiveRestaurantId) return;

    const load = async () => {
      console.log(
        'Loading menu for',
        effectiveRestaurantId,
        'subdomain',
        router.query.subdomain
      );
      const restRes = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", effectiveRestaurantId)
        .maybeSingle();

      const { data: catData, error: catErr } = await supabase
        .from('menu_categories')
        .select('id,name,description,image_url,sort_order,restaurant_id')
        .eq('restaurant_id', effectiveRestaurantId)
        .is('archived_at', null)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });

      const { data: itemData, error: itemErr } = await supabase
        .from('menu_items')
        .select(
          'id,name,description,price,image_url,is_vegetarian,is_vegan,is_18_plus,available,out_of_stock_until,sort_order,stock_status,stock_return_date,category_id'
        )
        .eq('restaurant_id', effectiveRestaurantId)
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
          .select(ITEM_ADDON_LINK_WITH_GROUPS_SELECT)
          .in('item_id', liveItemIds)
          .is('addon_groups.archived_at', null)
          .is('addon_groups.addon_options.archived_at', null);
        if (addonErr) console.error('Failed to fetch addons', addonErr);
        addonRows = addData || [];
      }

      const addonMap: Record<number, any[]> = {};
      addonRows.forEach((row) => {
        const arr = addonMap[row.item_id] || [];
        if (row.addon_groups) {
          const group = {
            ...row.addon_groups,
            addon_options: (row.addon_groups.addon_options || []).filter(
              (opt: any) => opt?.archived_at == null && opt?.available !== false
            ),
          };
          arr.push(group);
        }
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
          rid: effectiveRestaurantId,
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
          rid: effectiveRestaurantId,
          cats: catData?.length || 0,
          items: itemData?.length || 0,
        });
      }
      setLoading(false);
    };

    load();
  }, [routerReady, ridLoading, effectiveRestaurantId]);


  const Inner = () => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const [activeCat, setActiveCat] = useState<string | undefined>(undefined);
    const sectionsRef = useRef<Record<string, HTMLElement | null>>({});
    const scrollContainerRef = useRef<HTMLElement | null>(null);
    const SECTION_SCROLL_MARGIN = 132;
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
      if (Array.isArray(categories) && categories.length > 0) {
        setActiveCat((prev) => prev ?? String(categories[0].id));
      }
    }, [categories]);

    useEffect(() => {
      const root = document.getElementById('scroll-root') as HTMLElement | null;
      scrollContainerRef.current = root;

      const handleScroll = (_event: Event) => {
        const target = scrollContainerRef.current;
        const scrollTop = target ? target.scrollTop : window.scrollY;
        setShowTop(scrollTop > 400);
      };

      const target: HTMLElement | Window = root || window;
      target.addEventListener('scroll', handleScroll, { passive: true });

      return () => {
        target.removeEventListener('scroll', handleScroll);
      };
    }, []);

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
      if (c?.id) setActiveCat(String(c.id));
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const scrollToTop = () => {
      const target = scrollContainerRef.current;
      if (target) {
        target.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };


    return (
      <div>
        <div className="relative -mx-4 sm:-mx-6 md:-mx-8 lg:-mx-10 xl:-mx-12">
          {(() => {
            const menuTitle = restaurant?.website_title || restaurant?.name || 'Restaurant';
            return (
              <MenuHeader
                title={menuTitle}
                imageUrl={headerImg || undefined}
                focalX={headerFocalX}
                focalY={headerFocalY}
              />
            );
          })()}
        </div>

        {/* sticky category chips */}
        {Array.isArray(categories) && categories.length > 0 && (
          <div
            className="sticky top-[calc(env(safe-area-inset-top)+56px)] z-30 bg-white/90 backdrop-blur border-b border-neutral-200"
            style={{
              WebkitBackdropFilter: 'blur(12px)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="px-4 sm:px-6 max-w-6xl mx-auto py-3 flex gap-2 overflow-x-auto no-scrollbar">
              {categories.map((c: any) => {
                const isActive = activeCat === String(c.id);
                const baseCls =
                  'inline-flex items-center rounded-full px-4 sm:px-5 py-2 text-sm font-semibold whitespace-nowrap transition-all duration-200 border';
                const activeCls =
                  'shadow-sm shadow-black/5 text-white';
                const inactiveCls =
                  'bg-white text-neutral-900 border-neutral-200 hover:bg-neutral-50';
                return (
                  <button
                    key={c.id}
                    onClick={() => onChipSelect(c)}
                    className={`${baseCls} ${isActive ? activeCls : inactiveCls}`}
                    aria-pressed={isActive}
                    aria-current={isActive ? 'true' : undefined}
                    style={
                      isActive
                        ? { backgroundColor: 'var(--brand-primary)', borderColor: 'var(--brand-primary)' }
                        : undefined
                    }
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="px-4 sm:px-6 max-w-6xl mx-auto space-y-8 scroll-smooth pb-28">
          {/* Inline guards rendered inside layout */}
          {!routerReady || ridLoading ? (
            <div className="p-6" />
          ) : !effectiveRestaurantId ? (
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

          <div className="space-y-8">
            {categories.length === 0 ? (
              <p className="text-center text-gray-500">This menu is currently empty.</p>
            ) : (
              categories.map((cat) => {
                const catItems = items.filter(
                  (it) =>
                    it.category_id === cat.id ||
                    itemLinks.some(
                      (link) => link.item_id === it.id && link.category_id === cat.id,
                    ),
                );
                if (catItems.length === 0) return null;
                return (
                  <section
                    key={cat.id}
                    id={`cat-${cat.id}`}
                    data-cat-id={cat.id}
                    ref={(el) => (sectionsRef.current[cat.id] = el)}
                    style={{ scrollMarginTop: SECTION_SCROLL_MARGIN }}
                  >
                    {(() => {
                      return (
                        <div className="mt-8 mb-3">
                          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">{cat.name}</h2>
                        </div>
                      );
                    })()}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {catItems.map((item, idx) => (
                        <div
                          key={item.id}
                          className={`opacity-0 translate-y-2 transition-all duration-500 ease-out will-change-transform will-change-opacity ${mounted ? 'opacity-100 translate-y-0' : ''}`}
                          style={{ transitionDelay: `${idx * 75}ms` }}
                        >
                          <MenuItemCard
                            item={item}
                            restaurantId={effectiveRestaurantId as string}
                            restaurantLogoUrl={restaurant?.logo_url ?? null}
                          />
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
              onClick={scrollToTop}
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
    const { data } = await supaServer
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
