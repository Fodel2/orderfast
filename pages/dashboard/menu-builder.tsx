import { useEffect, useState, useRef, useMemo } from 'react';
import {
  DndContext,
  PointerSensor,
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
import { supabase } from '../../utils/supabaseClient';
import AddItemModal from '../../components/AddItemModal';
import AddCategoryModal from '../../components/AddCategoryModal';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import DraftCategoryModal from '../../components/DraftCategoryModal';
import ViewItemModal from '../../components/ViewItemModal';
import DashboardLayout from '../../components/DashboardLayout';
import AddonsTab from '../../components/AddonsTab';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  ArrowsUpDownIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

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
    .map(({ id, category_id, name, description, price, sort_order }) => ({
      id,
      category_id,
      name,
      description,
      price,
      sort_order,
    }))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

const deepEqual = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);

// Small wrapper component used for dnd-kit sortable items
function SortableWrapper({ id, children }: { id: number; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    background: isDragging ? '#f0f0f0' : undefined,
    cursor: isDragging ? 'grabbing' : 'grab',
  } as React.CSSProperties;
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="select-none">
      {children}
    </div>
  );
}

export default function MenuBuilder() {
  // Setup sensors for drag and drop interactions
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
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
  const [activeTab, setActiveTab] = useState<'menu' | 'addons' | 'stock' | 'build'>('menu');
  const [toastMessage, setToastMessage] = useState('');
  // Draft menu state for the Build tab
  const [buildCategories, setBuildCategories] = useState<any[]>([]);
  const [buildItems, setBuildItems] = useState<any[]>([]);
  const [showDraftItemModal, setShowDraftItemModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [showDraftCategoryModal, setShowDraftCategoryModal] = useState(false);
  const [draftCategory, setDraftCategory] = useState<any | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [confirmState, setConfirmState] = useState<
    | { title: string; message: string; action: () => void }
    | null
  >(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  // Load draft menu from localStorage
  useEffect(() => {
    const cats = localStorage.getItem('draftCategories');
    const its = localStorage.getItem('draftItems');
    if (cats) setBuildCategories(JSON.parse(cats));
    if (its) setBuildItems(JSON.parse(its));
  }, []);

  // Auto-save draft menu to localStorage
  useEffect(() => {
    localStorage.setItem('draftCategories', JSON.stringify(buildCategories));
    localStorage.setItem('draftItems', JSON.stringify(buildItems));
  }, [buildCategories, buildItems]);

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
    setCollapsedCats(new Set(categories.map((c) => c.id)));
  };

  const expandAll = () => {
    setCollapsedCats(new Set());
  };

  const handleItemClick = (item: any) => {
    setSelectedItem(item);
    if (activeTab === 'build') {
      setShowDraftItemModal(true);
    } else {
      setShowViewModal(true);
    }
  };

  const handleHeroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setHeroImage(url);
    }
  };

  const removeHeroImage = () => {
    setHeroImage(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  // Persist new ordering for categories
  const handleCategoryDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    const newCats = arrayMove(categories, oldIndex, newIndex);
    setCategories(newCats);
    await Promise.all(
      newCats.map((cat, idx) =>
        supabase.from('menu_categories').update({ sort_order: idx }).eq('id', cat.id)
      )
    );
    setOrigCategories(newCats);
  };

  // Reorder draft categories locally
  const handleDraftCategoryDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = buildCategories.findIndex((c) => c.id === active.id);
    const newIndex = buildCategories.findIndex((c) => c.id === over.id);
    const newCats = arrayMove(buildCategories, oldIndex, newIndex);
    setBuildCategories(newCats);
  };

  // Reorder draft items locally
  const handleDraftItemDragEnd =
    (categoryId: number) => async ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;
      const catItems = buildItems
        .filter((i) => i.category_id === categoryId)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const oldIndex = catItems.findIndex((i) => i.id === active.id);
      const newIndex = catItems.findIndex((i) => i.id === over.id);
      const sorted = arrayMove(catItems, oldIndex, newIndex);

      const updated = [...buildItems];
      await Promise.all(
        sorted.map((it, idx) => {
          const gi = updated.findIndex((i) => i.id === it.id);
          updated[gi] = { ...it, sort_order: idx };
          if (typeof it.id === 'number') {
            return supabase
              .from('draft_menu_items')
              .update({ sort_order: idx })
              .eq('id', it.id);
          }
          return Promise.resolve();
        })
      );
      setBuildItems(updated);
    };

  // Persist new ordering for items within a category
  const handleItemDragEnd = (categoryId: number) => async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const catItems = items.filter((i) => i.category_id === categoryId);
    const oldIndex = catItems.findIndex((i) => i.id === active.id);
    const newIndex = catItems.findIndex((i) => i.id === over.id);
    const sorted = arrayMove(catItems, oldIndex, newIndex);

    const updated = [...items];
    sorted.forEach((it, idx) => {
      const gi = updated.findIndex((i) => i.id === it.id);
      updated[gi] = { ...it, sort_order: idx };
    });
    setItems(updated);

    await Promise.all(
      sorted.map((it, idx) =>
        supabase.from('menu_items').update({ sort_order: idx }).eq('id', it.id)
      )
    );
    setOrigItems(updated);
  };

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

    const { data: categoriesData, error: catError } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('restaurant_id', rid)
      .order('sort_order', { ascending: true });

    const { data: itemsData, error: itemsError } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', rid)
      .order('sort_order', { ascending: true });

    if (catError || itemsError) {
      console.error('Error fetching data:', catError || itemsError);
    } else {
      setCategories(categoriesData || []);
      setItems(itemsData || []);
      setOrigCategories(categoriesData || []);
      setOrigItems(itemsData || []);
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

  const publishLiveMenu = async () => {
    if (!restaurantId) return;
    try {
      await Promise.all(
        categories.map((cat, idx) =>
          supabase
            .from('menu_categories')
            .update({ name: cat.name, description: cat.description, sort_order: idx })
            .eq('id', cat.id)
        )
      );
      await Promise.all(
        items.map((it) =>
          supabase
            .from('menu_items')
            .update({
              name: it.name,
              description: it.description,
              price: it.price,
              sort_order: it.sort_order,
            })
            .eq('id', it.id)
        )
      );
      setOrigCategories(categories);
      setOrigItems(items);
      setToastMessage('Menu published');
    } catch (err) {
      console.error(err);
      setToastMessage('Failed to publish menu');
    }
  };

  // Publish draft menu to Supabase as the live menu
  const publishMenu = async () => {
    if (!restaurantId) return;
    setConfirmState({
      title: 'Publish menu',
      message: 'This will replace your live menu with the build menu. Continue?',
      action: async () => {
        try {
          await supabase.from('menu_items').delete().eq('restaurant_id', restaurantId);
          await supabase.from('menu_categories').delete().eq('restaurant_id', restaurantId);
          const idMap = new Map<number, number>();
          for (let i = 0; i < buildCategories.length; i++) {
            const bc = buildCategories[i];
            const { data: cd, error: ce } = await supabase
              .from('menu_categories')
              .insert([
                {
                  name: bc.name,
                  description: bc.description,
                  restaurant_id: restaurantId,
                  sort_order: i,
                },
              ])
              .select()
              .single();
            if (ce || !cd) throw ce;
            idMap.set(bc.id, cd.id);
          }
          for (let i = 0; i < buildItems.length; i++) {
            const bi = buildItems[i];
            const cid = idMap.get(bi.category_id);
            if (!cid) continue;
            const { error: ie } = await supabase.from('menu_items').insert([
              {
                restaurant_id: restaurantId,
                category_id: cid,
                name: bi.name,
                description: bi.description,
                price: bi.price,
                sort_order: bi.sort_order || 0,
              },
            ]);
            if (ie) throw ie;
          }
          setToastMessage('Menu published');
          fetchData(restaurantId);
        } catch (err) {
          console.error(err);
          setToastMessage('Failed to publish menu');
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
            onClick={() => fileRef.current?.click()}
            className="relative w-40 h-24 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer overflow-hidden text-gray-400"
          >
            {heroImage ? (
              <>
                <img src={heroImage} alt="Hero" className="object-cover w-full h-full" />
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
          </div>
          <input type="file" accept="image/*" ref={fileRef} onChange={handleHeroChange} className="hidden" aria-label="Upload hero image" />
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
              className="flex items-center bg-teal-600 text-white px-3 py-2 rounded-lg hover:bg-teal-700"
            >
              <PlusCircleIcon className="w-5 h-5 mr-1" /> Add Category
            </button>
            <button
              onClick={duplicateLiveMenu}
              className="flex items-center bg-teal-600 text-white px-3 py-2 rounded-lg hover:bg-teal-700"
            >
              Duplicate Live Menu
            </button>
            <button
              onClick={deleteAllDraft}
              className="flex items-center bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700"
            >
              Delete All
            </button>
          </div>
          <button
            onClick={publishMenu}
            disabled={!hasBuildChanges}
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
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
                <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  {categories.map((cat) => (
                    <SortableWrapper key={cat.id} id={cat.id}>
                      <div className="bg-white rounded-xl shadow mb-4">
                        <div className="flex items-start justify-between p-4">
                    <div className="flex items-start space-x-3">
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
                      {/* actions removed in read-only menu */}
                    </div>
                  </div>
                  {!collapsedCats.has(cat.id) && (
                    <div className="px-4 pb-4">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleItemDragEnd(cat.id)}
                      >
                        <SortableContext
                          items={items
                            .filter((i) => i.category_id === cat.id)
                            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                            .map((i) => i.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {items
                              .filter((item) => item.category_id === cat.id)
                              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                              .map((item) => (
                                <SortableWrapper key={item.id} id={item.id}>
                                  <div
                                    onClick={() => handleItemClick(item)}
                                    className="cursor-grab bg-gray-50 rounded-lg p-3 flex items-start justify-between"
                                  >
                                    <div className="flex items-start space-x-2 overflow-hidden">
                                      <div className="w-12 h-12 bg-gray-200 rounded flex-shrink-0 overflow-hidden">
                                        {item.image_url && (
                                          <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                                        )}
                                      </div>
                                      <div className="truncate">
                                        <p className="font-medium truncate text-sm">{item.name}</p>
                                        <p className="text-xs text-gray-500 truncate">{item.description}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-sm font-semibold">${item.price.toFixed(2)}</span>
                                    </div>
                                  </div>
                                </SortableWrapper>
                              ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  )}
                </div>
              </SortableWrapper>
            ))}
          </SortableContext>
        </DndContext>
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
                      <div className="bg-white rounded-xl shadow mb-4">
                        <div className="flex items-start justify-between p-4">
                          <div className="flex items-start space-x-3">
                            <span className="cursor-grab select-none">☰</span>
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
                                        <div
                                          onClick={() => handleItemClick(item)}
                                          className="cursor-grab bg-gray-50 rounded-lg p-3 flex items-start justify-between"
                                        >
                                          <div className="flex items-start space-x-2 overflow-hidden">
                                            <span className="cursor-grab select-none mr-2">☰</span>
                                          <div className="w-12 h-12 bg-gray-200 rounded flex-shrink-0 overflow-hidden">
                                            {item.image_url && (
                                              <img src={item.image_url} alt="" className="object-cover w-full h-full" />
                                            )}
                                          </div>
                                            <div className="truncate">
                                              <p className="font-medium truncate text-sm">{item.name}</p>
                                              <p className="text-xs text-gray-500 truncate">{item.description}</p>
                                            </div>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <span className="text-sm font-semibold">${item.price.toFixed(2)}</span>
                                            {/* Removed item-level delete button; delete now handled in modal */}
                                          </div>
                                        </div>
                                      </SortableWrapper>
                                    ))}
                                </div>
                              </SortableContext>
                            </DndContext>
                          </div>
                        )}
                      </div>
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
      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
      <ViewItemModal
        showModal={showViewModal}
        item={selectedItem}
        onClose={() => {
          setShowViewModal(false);
          setSelectedItem(null);
        }}
      />
    </DashboardLayout>
  );
}

