import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Search, ChevronUp } from "lucide-react";
import CategoryIcon from "../../components/CategoryIcon";
import { supabase } from "../../utils/supabaseClient";
import MenuItemCard from "../../components/MenuItemCard";
import { useCart } from "../../context/CartContext";
import CustomerLayout from "../../components/CustomerLayout";


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
  is_vegetarian: boolean | null;
  is_18_plus: boolean | null;
  available?: boolean | null;
  stock_status: "in_stock" | "scheduled" | "out" | null;
  category_id: number;
}

export default function RestaurantMenuPage() {
  const router = useRouter();
  const { restaurant_id } = router.query;
  const restaurantId = Array.isArray(restaurant_id)
    ? restaurant_id[0]
    : restaurant_id;

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

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const navRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToCategory = (id: number) => {
    const section = sectionRefs.current[id];
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const btn = btnRefs.current[id];
    const nav = navRef.current;
    if (btn && nav) {
      nav.scrollTo({
        left: btn.offsetLeft - nav.clientWidth / 2 + btn.clientWidth / 2,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    if (!router.isReady) return;

    if (!restaurantId) {
      setLoading(false);
      return;
    }

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
        .from("menu_categories")
        .select(
          `id,name,description,image_url,sort_order,restaurant_id,menu_items!inner(
            id,name,description,price,image_url,is_vegetarian,is_18_plus,stock_status,available,category_id,sort_order,
            menu_item_categories(category_id)
          )`,
        )
        .eq("restaurant_id", restaurantId)
        .order("sort_order", { ascending: true })
        .order("sort_order", { foreignTable: "menu_items", ascending: true });

      console.log('Raw category query data:', catData);

      if (restRes.error)
        console.error("Failed to fetch restaurant", restRes.error);
      if (catErr) console.error("Failed to fetch categories", catErr);

      const cats: Category[] = [];
      const itms: Item[] = [];
      const links: { item_id: number; category_id: number }[] = [];

      for (const row of catData || []) {
        cats.push({
          id: row.id,
          name: row.name,
          description: row.description,
          image_url: row.image_url,
          sort_order: row.sort_order,
          restaurant_id: row.restaurant_id,
        });
        for (const it of row.menu_items || []) {
          if (it.available && it.stock_status !== "out") {
            itms.push({
              id: it.id,
              name: it.name,
              description: it.description,
              price: it.price,
              image_url: it.image_url,
              is_vegetarian: it.is_vegetarian,
              is_18_plus: it.is_18_plus,
              available: it.available,
              stock_status: it.stock_status,
              category_id: it.category_id,
            });
            for (const l of it.menu_item_categories || []) {
              links.push({ item_id: it.id, category_id: l.category_id });
            }
          }
        }
      }

      console.log("Restaurant data:", restRes.data);
      console.log("Category data:", cats);
      console.log("Item data:", itms);
      console.log("Item link data:", links);

      setRestaurant(restRes.data as Restaurant | null);
      setCategories(cats);
      setItems(itms);
      setItemLinks(links);
      setLoading(false);
    };

    load();
  }, [router.isReady, restaurantId]);

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading...</div>;
  }

  if (!restaurant) {
    return (
      <div className="p-6 text-center text-red-500">
        No restaurant specified
      </div>
    );
  }

  return (
    <CustomerLayout cartCount={itemCount}>
    <div className="p-4 space-y-8 scroll-smooth">
      <div className="text-center space-y-4">
        {restaurant.logo_url && (
          <img
            src={restaurant.logo_url}
            alt={`${restaurant.name} logo`}
            className="mx-auto h-24 object-contain"
          />
        )}
        <h1 className="text-3xl font-bold">{restaurant.name}</h1>
        {restaurant.website_description && (
          <p className="text-gray-600">{restaurant.website_description}</p>
        )}
      </div>

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

      <div
        ref={navRef}
        className="overflow-x-auto -mx-4 px-4 pb-2 scrollbar-hide snap-x snap-mandatory"
      >
        <div className="flex space-x-3 w-max">
          {categories.map((c) => (
            <button
              key={c.id}
              ref={(el) => (btnRefs.current[c.id] = el)}
              onClick={() => scrollToCategory(c.id)}
              className="flex flex-col items-center justify-center flex-shrink-0 w-20 h-20 bg-white rounded-full shadow hover:bg-gray-50 transition snap-start"
              aria-label={`View ${c.name}`}
            >
              {c.image_url ? (
                <img
                  src={c.image_url}
                  alt={c.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <CategoryIcon category={c.name} />
              )}
              <span className="text-xs mt-1 whitespace-nowrap">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

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
                id={`cat-${cat.id}`}
                key={cat.id}
                ref={(el) => {
                  sectionRefs.current[cat.id] = el as HTMLDivElement;
                }}
                className="space-y-4 scroll-mt-24"
              >
                <h2 className="text-xl font-semibold text-left">{cat.name}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catItems.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      restaurantId={restaurantId as string}
                    />
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
