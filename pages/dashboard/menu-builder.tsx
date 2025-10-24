import { useEffect, useState, useRef, useMemo } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { STORAGE_BUCKET } from '../../lib/storage';
import AddItemModal from '../../components/AddItemModal';
import AddCategoryModal from '../../components/AddCategoryModal';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import DraftCategoryModal from '../../components/DraftCategoryModal';
import MenuItemCard from '../../components/MenuItemCard';
import DashboardLayout from '../../components/DashboardLayout';
import AddonsTab from '../../components/AddonsTab';
import StockTab, { StockTabProps } from '../../components/StockTab';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  ArrowsUpDownIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import ImageEditorModal from '@/components/ImageEditorModal';

const normalizeCats = (arr: any[]) =>
  [...arr]
    .map(({ id, name, description, sort_order }) => ({
      id,
      name,
      description,
      sort_order,
    }))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

const normalizeItems = (arr: any[]) =>
  [...arr]
    .map(({ id, category_id, name, description, price, sort_order, addons }) => ({
      id,
      category_id,
      name,
      description,
      price,
      sort_order,
      addons: Array.isArray(addons)
        ? [...addons].map(String).sort((a, b) => a.localeCompare(b))
        : [],
    }))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

const deepEqual = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);

const createExternalKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
};

const normalizeDraftItem = (item: any) => {
  const addons = Array.isArray(item.addons) ? item.addons.map(String) : [];
  const externalKey =
    typeof item.external_key === 'string' && item.external_key
      ? item.external_key
      : createExternalKey();
  return {
    ...item,
    external_key: externalKey,
    addons,
  };
};

// Small wrapper component used for dnd-kit sortable items
function SortableWrapper({
  id,
  children,
}: {
  id: number;
  children: (args: {
    setNodeRef: (node: HTMLElement | null) => void;
    style: React.CSSProperties;
    attributes: any;
    listeners: any;
  }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    background: isDragging ? '#f0f0f0' : undefined,
  } as React.CSSProperties;
  return <>{children({ setNodeRef, style, attributes, listeners })}</>;
}

export default function MenuBuilder() {
  // Setup sensors for drag and drop interactions
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  );
  const [session, setSession] = useState(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [origCategories, setOrigCategories] = useState<any[]>([]);
  const [origItems, setOrigItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [editCategory, setEditCategory] = useState<any | null>(null);
  const [defaultCategoryId, setDefaultCategoryId] = useState<number | null>(null);
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Set<number>>(new Set());
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [heroFocal, setHeroFocal] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const [editorImage, setEditorImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [activeTab, setActiveTab] = useState<'menu' | 'addons' | 'stock' | 'build'>('menu');
  const [toastMessage, setToastMessage] = useState('');
  // Draft menu state for the Build tab
  const [buildCategories, setBuildCategories] = useState<any[]>([]);
  const [buildItems, setBuildItems] = useState<any[]>([]);
  const [origBuildCategories, setOrigBuildCategories] = useState<any[]>([]);
  const [origBuildItems, setOrigBuildItems] = useState<any[]>([]);
  const [showDraftItemModal, setShowDraftItemModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [showDraftCategoryModal, setShowDraftCategoryModal] = useState(false);
  const [draftCategory, setDraftCategory] = useState<any | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [confirmState, setConfirmState] = useState<
    | { title: string; message: string; action: () => void }
    | null
  >(null);
  const [stockCategories, setStockCategories] = useState<StockTabProps['categories']>([]);
  const [stockAddons, setStockAddons] = useState<StockTabProps['addons']>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const saveAbort = useRef<AbortController | null>(null);
  const draftErrorShown = useRef(false);
  const [publishing, setPublishing] = useState(false);
  const router = useRouter();
  const isDev = process.env.NODE_ENV !== 'production';

  useEffect(() => {
    if (!router.isReady) return;
    const t = router.query.tab;
    if (t === 'menu' || t === 'addons' || t === 'stock' || t === 'build') {
      setActiveTab(t as any);
    }
  }, [router.isReady, router.query.tab]);

  // Load draft menu from API when restaurantId is known
  useEffect(() => {
    if (!restaurantId) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/menu-builder?restaurant_id=${restaurantId}&withAddons=1`
        );
        if (res.status < 200 || res.status >= 300)
          throw new Error('Failed to load draft');
        const json = await res.json().catch(() => ({}));
        const draft = json.draft ?? json.payload ?? json.data ?? json.draft_json ?? {};
        const cats = Array.isArray(draft?.categories) ? draft.categories : [];
        const itemsArr = Array.isArray(draft?.items) ? draft.items : [];
        const items = itemsArr.map(normalizeDraftItem);
        setBuildCategories(cats);
        setBuildItems(items);
        setOrigBuildCategories(cats);
        setOrigBuildItems(items);
        setDraftLoaded(true);
      } catch (err) {
        console.error(err);
        setBuildCategories([]);
        setBuildItems([]);
        setOrigBuildCategories([]);
        setOrigBuildItems([]);
      }
      if (process.env.NODE_ENV === 'development') {
        console.debug('[menu-builder] draft loaded');
      }
    })();
  }, [restaurantId]);

  // Auto-save draft menu to DB with debounce
  const draftDirty = useMemo(() => {
    return (
      !deepEqual(normalizeCats(buildCategories), normalizeCats(origBuildCategories)) ||
      !deepEqual(normalizeItems(buildItems), normalizeItems(origBuildItems))
    );
  }, [buildCategories, origBuildCategories, buildItems, origBuildItems]);

  useEffect(() => {
    if (!restaurantId || !draftLoaded || !draftDirty) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (saveAbort.current) saveAbort.current.abort();
    saveTimer.current = setTimeout(async () => {
      try {
        saveAbort.current = new AbortController();
        const res = await fetch(`/api/menu-builder`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantId,
            draft: {
              categories: buildCategories,
              items: buildItems,
            },
          }),
          signal: saveAbort.current.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.message || json.error || 'Failed to save draft');
        }
        draftErrorShown.current = false;
        setToastMessage('Draft saved');
        const savedDraft = json?.draft ?? json?.payload;
        if (savedDraft) {
          const savedCategories = Array.isArray(savedDraft.categories)
            ? savedDraft.categories
            : [];
          const savedItems = Array.isArray(savedDraft.items)
            ? savedDraft.items.map(normalizeDraftItem)
            : [];
          setBuildCategories(savedCategories);
          setBuildItems(savedItems);
          setOrigBuildCategories(savedCategories);
          setOrigBuildItems(savedItems);
        } else {
          setOrigBuildCategories(buildCategories);
          setOrigBuildItems(buildItems);
        }
        if (process.env.NODE_ENV === 'development') {
          console.debug('[menu-builder] draft saved');
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        if (!draftErrorShown.current) {
          console.error(err);
          setToastMessage(
            isDev && err.message ? `Draft save failed: ${err.message}` : 'Draft save failed'
          );
          draftErrorShown.current = true;
        }
      }
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveAbort.current?.abort();
    };
  }, [restaurantId, draftLoaded, buildCategories, buildItems, draftDirty]);

  // Load stock data when Stock tab is opened
  useEffect(() => {
    const loadStock = async (rid: number) => {
      setStockLoading(true);
      const { data: catData } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('restaurant_id', rid)
        .is('archived_at', null)
        .order('archived_at', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });
      const { data: itemData } = await supabase
        .from('menu_items')
        .select('id,name,category_id,stock_status,stock_return_date')
        .eq('restaurant_id', rid)
        .is('archived_at', null)
        .order('archived_at', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });
      const mappedCats = (catData || []).map((c) => ({
        id: String(c.id),
        name: c.name,
        items: (itemData || [])
          .filter((i) => i.category_id === c.id)
          .map((i) => ({
            id: String(i.id),
            name: i.name,
            stock_status: i.stock_status,
            stock_return_date: i.stock_return_date,
          })),
      }));

      const { data: groups } = await supabase
        .from('addon_groups')
        .select('id')
        .eq('restaurant_id', rid)
        .is('archived_at', null);
      let mappedAddons: StockTabProps['addons'] = [];
      if (groups && groups.length) {
        const { data: opts } = await supabase
          .from('addon_options')
          .select('id,name,group_id,stock_status,stock_return_date,available,out_of_stock_until,stock_last_updated_at')
          .in('group_id', groups.map((g) => g.id))
          .is('archived_at', null);
        mappedAddons = (opts || []).map((o) => ({
          id: String(o.id),
          name: o.name,
          stock_status: o.stock_status,
          stock_return_date: o.stock_return_date,
          available: o.available,
          out_of_stock_until: o.out_of_stock_until,
          stock_last_updated_at: o.stock_last_updated_at,
        }));
      }

      setStockCategories(mappedCats);
      setStockAddons(mappedAddons);
      setStockLoading(false);
    };
    if (activeTab === 'stock' && restaurantId) {
      loadStock(restaurantId);
    }
  }, [activeTab, restaurantId]);

  const hasMenuChanges = useMemo(() => {
    return (
      !deepEqual(normalizeCats(categories), normalizeCats(origCategories)) ||
      !deepEqual(normalizeItems(items), normalizeItems(origItems))
    );
  }, [categories, origCategories, items, origItems]);

  const hasBuildChanges = useMemo(() => {
    return (
      !deepEqual(normalizeCats(buildCategories), normalizeCats(categories)) ||
      !deepEqual(normalizeItems(buildItems), normalizeItems(items))
    );
  }, [buildCategories, categories, buildItems, items]);

  const toggleCollapse = (id: number) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const collapseAll = () => {
    const cats = activeTab === 'build' ? buildCategories : categories;
    setCollapsedCats(new Set(cats.map((c) => c.id)));
  };

  const expandAll = () => {
    setCollapsedCats(new Set());
  };

  const handleItemClick = (item: any) => {
    setSelectedItem(item);
    setShowDraftItemModal(true);
  };

  const handleHeroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (img.width < 1600 || img.height < 900) {
        setToastMessage('Image must be at least 1600x900');
        URL.revokeObjectURL(url);
        if (fileRef.current) fileRef.current.value = '';
        return;
      }
      setImageFile(file);
      setEditorImage(url);
    };
    img.src = url;
  };

  const removeHeroImage = async () => {
    if (!restaurantId) return;
    setUploadingHero(true);
    await fetch('/api/restaurants/menu-header', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId, imageUrl: null, focalX: null, focalY: null }),
    });
    setHeroImage(null);
    setHeroFocal({ x: 0.5, y: 0.5 });
    setUploadingHero(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleHeroSave = async (coords: { x: number; y: number }) => {
    if (!imageFile || !restaurantId) return;
    setUploadingHero(true);
    const ext = imageFile.name.split('.').pop() || 'jpg';
    const path = `restaurants/${restaurantId}/menu-header.${ext}`;
    if (!STORAGE_BUCKET) {
      setToastMessage('Storage bucket not configured');
      setUploadingHero(false);
      return;
    }
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, imageFile, {
        upsert: true,
      });
    if (!upErr) {
      setUploadPct(100);
    } else {
      console.error('upload failed', upErr);
      const errText = [upErr.name, upErr.message]
        .filter(Boolean)
        .join(': ');
      setToastMessage(errText);
      setUploadingHero(false);
      return;
    }
    const publicUrl = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path).data.publicUrl;
    const res = await fetch('/api/restaurants/menu-header', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId, imageUrl: publicUrl, focalX: coords.x, focalY: coords.y }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Failed to save' }));
      setToastMessage(err.message);
    } else {
      setHeroImage(`${publicUrl}?v=${Date.now()}`);
      setHeroFocal(coords);
    }
    setUploadingHero(false);
    setEditorImage(null);
    setImageFile(null);
    setUploadPct(0);
    if (fileRef.current) fileRef.current.value = '';
  };

  // Reorder draft categories locally
  const handleDraftCategoryDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = buildCategories.findIndex((c) => c.id === active.id);
    const newIndex = buildCategories.findIndex((c) => c.id === over.id);
    const newCats = arrayMove(buildCategories, oldIndex, newIndex).map(
      (c, idx) => ({ ...c, sort_order: idx })
    );
    setBuildCategories(newCats);
  };

  // Reorder draft items locally
  const handleDraftItemDragEnd =
    (categoryId: number) => ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;
      const catItems = buildItems
        .filter((i) => i.category_id === categoryId)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const oldIndex = catItems.findIndex((i) => i.id === active.id);
      const newIndex = catItems.findIndex((i) => i.id === over.id);
      const sorted = arrayMove(catItems, oldIndex, newIndex);

      const updated = [...buildItems];
      sorted.forEach((it, idx) => {
        const gi = updated.findIndex((i) => i.id === it.id);
        updated[gi] = { ...it, sort_order: idx };
      });
      setBuildItems(updated);
    };

  // Persist new ordering for categories/items in live menu removed for read-only preview

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setSession(session);
        const { data: ru } = await supabase
          .from('restaurant_users')
          .select('restaurant_id')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (ru?.restaurant_id) {
          setRestaurantId(ru.restaurant_id);
          fetchData(ru.restaurant_id);
        }
      }
    };

    getSession();
  }, []);

  const fetchData = async (rid: number) => {
    setLoading(true);

    const { data: rest } = await supabase
      .from('restaurants')
      .select(
        'menu_header_image_url,menu_header_focal_x,menu_header_focal_y,menu_header_image_updated_at'
      )
      .eq('id', rid)
      .maybeSingle();

    if (rest) {
      const url = rest.menu_header_image_url;
      const updated = rest.menu_header_image_updated_at;
      setHeroImage(
        url ? `${url}${updated ? `?v=${new Date(updated).getTime()}` : ''}` : null
      );
      setHeroFocal({
        x: typeof rest.menu_header_focal_x === 'number' ? rest.menu_header_focal_x : 0.5,
        y: typeof rest.menu_header_focal_y === 'number' ? rest.menu_header_focal_y : 0.5,
      });
    }

    const { data: categoriesData, error: catError } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('restaurant_id', rid)
      .is('archived_at', null)
      .order('archived_at', { ascending: true, nullsFirst: true })
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true });

    const { data: itemsData, error: itemsError } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', rid)
      .is('archived_at', null)
      .order('archived_at', { ascending: true, nullsFirst: true })
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true });

    let itemsWithAddons = itemsData || [];
    if (itemsData && itemsData.length) {
      try {
        const linkRes = await fetch(
          `/api/menu-builder?restaurant_id=${rid}&withAddons=1`
        );
        if (!linkRes.ok) throw new Error('Failed to fetch addon links');
        const { addonLinks } = await linkRes.json();
        const map: Record<number, string[]> = {};
        (addonLinks || []).forEach((r: any) => {
          if (!map[r.item_id]) map[r.item_id] = [];
          map[r.item_id].push(String(r.group_id));
        });
        itemsWithAddons = itemsData.map((i) => ({
          ...i,
          addons: map[i.id] || [],
        }));
      } catch (err) {
        console.error('Error fetching addon links:', err);
      }
    }

    if (catError || itemsError) {
      console.error('Error fetching data:', catError || itemsError);
    } else {
      setCategories(categoriesData || []);
      setItems(itemsWithAddons);
      setOrigCategories(categoriesData || []);
      setOrigItems(itemsWithAddons);
    }

    setLoading(false);
  };

  const handleDeleteItem = async (id: number) => {
    if (!window.confirm('Delete this item?')) return;
    await supabase.from('menu_items').delete().eq('id', id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleDeleteDraftCategory = (id: number) => {
    const hasItems = buildItems.some((i) => i.category_id === id);
    const msg = hasItems
      ? 'Delete this category and all items in it?'
      : 'Delete this category?';
    if (!window.confirm(msg)) return;
    setBuildCategories((prev) => prev.filter((c) => c.id !== id));
    setBuildItems((prev) => prev.filter((i) => i.category_id !== id));
  };

  // Duplicate live menu into the draft state
  const duplicateLiveMenu = () => {
    const doIt = () => {
      setBuildCategories(categories.map((c) => ({ ...c })));
      setBuildItems(items.map((i) => ({ ...i })));
      setToastMessage('Live menu duplicated');
    };
    if (buildCategories.length || buildItems.length) {
      setConfirmState({
        title: 'Overwrite build menu?',
        message:
          'Duplicating the live menu will overwrite all items in your current build menu. Continue?',
        action: doIt,
      });
    } else {
      doIt();
    }
  };

  // Delete all draft items and categories
  const deleteAllDraft = () => {
    setConfirmState({
      title: 'Delete build menu',
      message:
        'Are you sure you want to delete ALL items from your build menu? This cannot be undone.',
      action: () => {
        setBuildCategories([]);
        setBuildItems([]);
      },
    });
  };

  // Publish draft menu via API that hard-replaces live menu
  const publishLiveMenu = async () => {
    if (!restaurantId) return;
    setConfirmState({
      title: 'Publish menu',
      message: 'This will replace your live menu with the build menu. Continue?',
      action: async () => {
        try {
          setPublishing(true);
          const draft = { categories: buildCategories, items: buildItems };
          const saveRes = await fetch(`/api/menu-builder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ restaurantId, draft }),
          });
          const saveJson = await saveRes.json().catch(() => ({}));
          if (!saveRes.ok) {
            setToastMessage(saveJson.error || saveJson.details || 'Failed to save draft');
            return;
          }

          const res = await fetch(`/api/publish-menu`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ restaurantId }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            setToastMessage(`${json.where}: ${json.error || json.details || 'Failed to publish menu'}`);
            return;
          }
          const { deleted = {}, archived = {}, inserted = {}, publish: publishCounts = {} } = json;
          const addonSummary = `Add-ons ${publishCounts.groups_inserted || 0} groups/${publishCounts.options_inserted || 0} options/${publishCounts.links_inserted || 0} links`;
          setToastMessage(
            `Deleted ${deleted.categories || 0}/${deleted.items || 0} Archived ${archived.categories || 0}/${archived.items || 0} Inserted ${inserted.categories || 0}/${inserted.items || 0} ${addonSummary}`
          );
          fetchData(restaurantId);
        } catch (err: any) {
          console.error(err);
          setToastMessage(err.message || 'Failed to publish menu');
        } finally {
          setPublishing(false);
        }
      },
    });
  };

  if (!session) return <p>Loading session...</p>;

  return (
    <DashboardLayout>
      {/* Top title and hero image */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold">Menu Manager</h1>
            <p className="text-sm text-gray-600 mt-1">Build and manage your categories, items, add-ons, and stock in real time.</p>
          </div>
          <div className="shrink-0">
            <div
              onClick={() => !uploadingHero && fileRef.current?.click()}
              className="relative w-40 h-24 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer overflow-hidden text-gray-400"
            >
              {heroImage ? (
                <>
                  <img
                    src={heroImage}
                    alt="Hero"
                    className="object-cover w-full h-full"
                    style={{ objectPosition: `${heroFocal.x * 100}% ${heroFocal.y * 100}%` }}
                  />
                  <button
                    type="button"
                    onClick={removeHeroImage}
                    aria-label="Remove image"
                    className="absolute top-1 right-1 bg-white/70 rounded-full p-1 hover:bg-white"
                  >
                    <TrashIcon className="w-4 h-4 text-red-600" />
                  </button>
                </>
              ) : (
                <span className="text-sm">Upload image</span>
              )}
              {uploadingHero && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-sm">
                  {uploadPct ? `${uploadPct}%` : 'Uploading...'}
                </div>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              ref={fileRef}
              onChange={handleHeroChange}
              className="hidden"
              aria-label="Upload hero image"
            />
          </div>
        </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="flex space-x-4 overflow-x-auto">
          {[
            { key: 'menu', label: 'Menu' },
            { key: 'addons', label: 'Addons' },
            { key: 'stock', label: 'Stock' },
            { key: 'build', label: 'Build Menu' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`px-3 py-2 whitespace-nowrap font-medium focus:outline-none ${activeTab === t.key ? 'border-b-2 border-teal-600 text-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'build' && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setDraftCategory(null);
                setShowDraftCategoryModal(true);
              }}
              disabled={!restaurantId}
              className="flex items-center bg-teal-600 text-white px-3 py-2 rounded-lg hover:bg-teal-700"
            >
              <PlusCircleIcon className="w-5 h-5 mr-1" /> Add Category
            </button>
            <button
              onClick={duplicateLiveMenu}
              disabled={!restaurantId}
              className="flex items-center bg-teal-600 text-white px-3 py-2 rounded-lg hover:bg-teal-700"
            >
              Duplicate Live Menu
            </button>
            <button
              onClick={deleteAllDraft}
              disabled={!restaurantId}
              className="flex items-center bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700"
            >
              Delete All
            </button>
          </div>
          <button
            onClick={publishLiveMenu}
            disabled={!restaurantId || !hasBuildChanges || publishing}
            className="flex items-center bg-teal-600 text-white px-3 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            Publish Changes
          </button>
        </div>
      )}

      {activeTab === 'build' && (
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center text-sm text-gray-500 space-x-2">
            <ArrowsUpDownIcon className="w-4 h-4" />
            <span>Drag categories and items to reorder</span>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={expandAll} className="p-2 rounded hover:bg-gray-200" aria-label="Expand all">
              <ChevronDownIcon className="w-5 h-5" />
            </button>
            <button onClick={collapseAll} className="p-2 rounded hover:bg-gray-200" aria-label="Collapse all">
              <ChevronUpIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setDraftCategory(null);
                setShowDraftCategoryModal(true);
              }}
              className="flex items-center bg-teal-600 text-white px-3 py-2 rounded-lg hover:bg-teal-700"
            >
              <PlusCircleIcon className="w-5 h-5 mr-1" /> Add Category
            </button>
            {/* Publish button hidden on Menu tab */}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {activeTab === 'menu' && (
        <motion.div
            key="menu"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <span role="img" aria-label="plates">🍽️</span> Live Menu
                </h2>
                <div className="flex items-center space-x-3">
                  <button onClick={expandAll} className="p-2 rounded hover:bg-gray-200" aria-label="Expand all">
                    <ChevronDownIcon className="w-5 h-5" />
                  </button>
                  <button onClick={collapseAll} className="p-2 rounded hover:bg-gray-200" aria-label="Collapse all">
                    <ChevronUpIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                This is what your customers see right now. All published items appear here. Changes go live instantly!
              </p>
            </div>
            {loading ? (
              <p>Loading...</p>
            ) : categories.length === 0 ? (
              <div className="text-center text-gray-500 py-10">
                No menu categories found. Use "Add Category" to get started.
              </div>
            ) : (
              <div>
                {categories.map((cat) => (
                  <div key={cat.id} className="bg-white rounded-xl shadow mb-4">
                    <div className="flex items-start justify-between p-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h2 className="font-semibold text-lg">{cat.name}</h2>
                          <span className="text-xs bg-gray-200 rounded-full px-2">
                            {items.filter((i) => i.category_id === cat.id).length}
                          </span>
                        </div>
                        {cat.description && (
                          <p className="text-sm text-gray-500">{cat.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => toggleCollapse(cat.id)}
                        className="p-2 rounded hover:bg-gray-100"
                        aria-label="Toggle items"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {collapsedCats.has(cat.id) ? (
                          <ChevronDownIcon className="w-5 h-5" />
                        ) : (
                          <ChevronUpIcon className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {!collapsedCats.has(cat.id) && (
                      <div className="px-4 pb-4">
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {items
                            .filter((item) => item.category_id === cat.id)
                            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                            .map((item) => (
                              <MenuItemCard key={item.id} item={item} restaurantId={restaurantId!} />
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
        {activeTab === 'addons' && (
          <motion.div
            key="addons"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {restaurantId && <AddonsTab restaurantId={restaurantId} />}
          </motion.div>
        )}
        {activeTab === 'stock' && (
          <motion.div
            key="stock"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {stockLoading ? (
              <div className="p-4">Loading...</div>
            ) : (
              <StockTab categories={stockCategories} addons={stockAddons} />
            )}
          </motion.div>
        )}
        {activeTab === 'build' && (
          <motion.div
            key="build"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span role="img" aria-label="tools">🛠️</span> Build Menu
              </h2>
              <p className="text-sm text-gray-600">
                Draft your next big update! Make changes and preview them here—publish when you’re ready for the world to see.
              </p>
            </div>
            {buildCategories.length === 0 ? (
              <div className="text-center text-gray-500 py-10">
                No items in your build menu.
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDraftCategoryDragEnd}
              >
                <SortableContext
                  items={buildCategories.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {buildCategories.map((cat) => (
                    <SortableWrapper key={cat.id} id={cat.id}>
                      {({ setNodeRef, style, attributes, listeners }) => (
                        <div ref={setNodeRef} style={style} className="bg-white rounded-xl shadow mb-4">
                          <div className="flex items-start justify-between p-4">
                            <div className="flex items-start space-x-3">
                              <span
                                {...attributes}
                                {...listeners}
                                className="cursor-grab active:cursor-grabbing select-none touch-none"
                              >
                                ☰
                              </span>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <h2 className="font-semibold text-lg">{cat.name}</h2>
                                  <span className="text-xs bg-gray-200 rounded-full px-2">
                                    {buildItems.filter((i) => i.category_id === cat.id).length}
                                  </span>
                                </div>
                                {cat.description && (
                                  <p className="text-sm text-gray-500">{cat.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => toggleCollapse(cat.id)}
                                className="p-2 rounded hover:bg-gray-100"
                                aria-label="Toggle items"
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                {collapsedCats.has(cat.id) ? (
                                  <ChevronDownIcon className="w-5 h-5" />
                                ) : (
                                  <ChevronUpIcon className="w-5 h-5" />
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  setDraftCategory(cat);
                                  setShowDraftCategoryModal(true);
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                className="p-2 rounded hover:bg-gray-100"
                                aria-label="Edit category"
                              >
                                <PencilSquareIcon className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => {
                                  setDefaultCategoryId(cat.id);
                                  setSelectedItem(null);
                                  setShowDraftItemModal(true);
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                className="p-2 rounded hover:bg-gray-100"
                                aria-label="Add item"
                              >
                                <PlusCircleIcon className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleDeleteDraftCategory(cat.id)}
                                onPointerDown={(e) => e.stopPropagation()}
                                className="p-2 rounded hover:bg-red-100"
                                aria-label="Delete category"
                              >
                                <TrashIcon className="w-5 h-5 text-red-600" />
                              </button>
                            </div>
                          </div>
                          {!collapsedCats.has(cat.id) && (
                            <div className="px-4 pb-4">
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDraftItemDragEnd(cat.id)}
                              >
                                <SortableContext
                                  items={buildItems
                                    .filter((i) => i.category_id === cat.id)
                                    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                                    .map((i) => i.id)}
                                  strategy={verticalListSortingStrategy}
                                >
                                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {buildItems
                                      .filter((item) => item.category_id === cat.id)
                                      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                                      .map((item) => (
                                        <SortableWrapper key={item.id} id={item.id}>
                                          {({ setNodeRef, style, attributes, listeners }) => (
                                            <div ref={setNodeRef} style={style}>
                                              <div
                                                onClick={() => handleItemClick(item)}
                                                className="bg-gray-50 rounded-lg p-3 flex items-start justify-between cursor-pointer"
                                              >
                                                <div className="flex items-start space-x-2 overflow-hidden">
                                                  <span
                                                    {...attributes}
                                                    {...listeners}
                                                    className="cursor-grab active:cursor-grabbing select-none mr-2 touch-none"
                                                  >
                                                    ☰
                                                  </span>
                                                  <div className="w-12 h-12 bg-gray-200 rounded flex-shrink-0 overflow-hidden">
                                                    {item.image_url && (
                                                      <img
                                                        src={item.image_url}
                                                        alt=""
                                                        className="object-cover w-full h-full"
                                                      />
                                                    )}
                                                  </div>
                                                  <div className="truncate">
                                                    <p className="font-semibold truncate text-sm">{item.name}</p>
                                                    <p className="text-xs text-gray-500 truncate">{item.description}</p>
                                                  </div>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                  <span className="text-sm font-medium">${item.price.toFixed(2)}</span>
                                                  {/* Removed item-level delete button; delete now handled in modal */}
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </SortableWrapper>
                                      ))}
                                  </div>
                                </SortableContext>
                              </DndContext>
                            </div>
                          )}
                        </div>
                      )}
                    </SortableWrapper>
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <AddItemModal
        showModal={showAddModal}
        restaurantId={restaurantId!}
        defaultCategoryId={defaultCategoryId || undefined}
        item={editItem || undefined}
        onSaved={() => restaurantId && fetchData(restaurantId)}
        onDeleted={() => restaurantId && fetchData(restaurantId)}
        onClose={() => {
          setShowAddModal(false);
          setEditItem(null);
        }}
      />
      {showAddCatModal && (
        <AddCategoryModal
          category={editCategory || undefined}
          sortOrder={categories.length}
          restaurantId={restaurantId!}
          onClose={() => {
            setShowAddCatModal(false);
            setEditCategory(null);
          }}
          onCreated={() => {
            restaurantId && fetchData(restaurantId);
            setToastMessage('Category saved');
          }}
        />
      )}
 <AddItemModal
  showModal={showDraftItemModal}
  restaurantId={restaurantId!}
  defaultCategoryId={defaultCategoryId || undefined}
  item={selectedItem || undefined}
  categoriesProp={buildCategories}
  onSaveData={async (data, cats, addons) => {
    const categoryId = cats[0] ?? null;
    const base = { ...data, category_id: categoryId, addons };
    if (selectedItem) {
      setBuildItems((prev) =>
        prev.map((p) => (p.id === selectedItem.id ? { ...p, ...base } : p))
      );
    } else {
      const id = Date.now() + Math.random();
      const order = buildItems.filter((i) => i.category_id === categoryId).length;
      setBuildItems((prev) => [...prev, { ...base, id, sort_order: order }]);
    }
  }}
  onDeleteData={(id) => {
    setBuildItems((prev) => prev.filter((i) => i.id !== id));
  }}
  onClose={() => {
    setShowDraftItemModal(false);
    setSelectedItem(null);
  }}
/>
      {showDraftCategoryModal && (
        <DraftCategoryModal
          show={showDraftCategoryModal}
          category={draftCategory || undefined}
          onClose={() => {
            setShowDraftCategoryModal(false);
            setDraftCategory(null);
          }}
          // DraftCategoryModal will close itself after showing a success overlay
          onSave={(cat) => {
            if (draftCategory) {
              setBuildCategories((prev) =>
                prev.map((c) => (c.id === draftCategory.id ? { ...c, ...cat } : c))
              );
            } else {
              const id = Date.now() + Math.random();
              setBuildCategories((prev) => [
                ...prev,
                {
                  id,
                  name: cat.name,
                  description: cat.description,
                  sort_order: prev.length,
                },
              ]);
            }
          }}
        />
      )}
        {confirmState && (
          <ConfirmModal
            show={true}
            title={confirmState.title}
            message={confirmState.message}
            onConfirm={() => {
              confirmState.action();
              setConfirmState(null);
            }}
            onCancel={() => setConfirmState(null)}
          />
        )}
        {editorImage && (
          <ImageEditorModal
            src={editorImage}
            open={true}
            onCancel={() => {
              setEditorImage(null);
              setImageFile(null);
            }}
            onSave={handleHeroSave}
          />
        )}
        <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </DashboardLayout>
  );
}

