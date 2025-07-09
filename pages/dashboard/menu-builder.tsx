import { useEffect, useState } from 'react';
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
import DashboardLayout from '../../components/DashboardLayout';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  ArrowsUpDownIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

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
  const sensors = useSensors(useSensor(PointerSensor));
  const [session, setSession] = useState(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [editCategory, setEditCategory] = useState<any | null>(null);
  const [defaultCategoryId, setDefaultCategoryId] = useState<number | null>(null);
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Set<number>>(new Set());
  const router = useRouter();

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
    }

    setLoading(false);
  };

  const handleDeleteItem = async (id: number) => {
    if (!window.confirm('Delete this item?')) return;
    await supabase.from('menu_items').delete().eq('id', id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  if (!session) return <p>Loading session...</p>;

  return (
    <DashboardLayout>
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
              setEditCategory(null);
              setShowAddCatModal(true);
            }}
            className="flex items-center bg-[#b91c1c] text-white px-3 py-2 rounded-lg hover:bg-[#a40f0f]"
          >
            <PlusCircleIcon className="w-5 h-5 mr-1" /> Add Category
          </button>
        </div>
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
                      <span className="cursor-grab select-none">☰</span>
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
                      <button
                        onClick={() => {
                          setEditCategory(cat);
                          setShowAddCatModal(true);
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
                          setEditItem(null);
                          setShowAddModal(true);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="p-2 rounded hover:bg-gray-100"
                        aria-label="Add item"
                      >
                        <PlusCircleIcon className="w-5 h-5" />
                      </button>
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
                          items={items.filter((i) => i.category_id === cat.id).map((i) => i.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <ul className="space-y-2">
                            {items
                              .filter((item) => item.category_id === cat.id)
                              .map((item) => (
                                <SortableWrapper key={item.id} id={item.id}>
                                  <li
                                    onClick={() => {
                                      setEditItem(item);
                                      setDefaultCategoryId(null);
                                      setShowAddModal(true);
                                    }}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    className="cursor-grab bg-gray-50 rounded-lg p-2 flex items-center justify-between"
                                  >
                                    <div className="flex items-center space-x-2 overflow-hidden">
                                      <div className="w-10 h-10 bg-gray-200 rounded flex-shrink-0 overflow-hidden">
                                        {item.image_url && (
                                          <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                                        )}
                                      </div>
                                      <div className="truncate">
                                        <p className="font-medium truncate">{item.name}</p>
                                        <p className="text-xs text-gray-500 truncate">{item.description}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-sm font-semibold">${item.price.toFixed(2)}</span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteItem(item.id);
                                        }}
                                        className="p-1 rounded hover:bg-gray-200"
                                        aria-label="Delete item"
                                      >
                                        <TrashIcon className="w-4 h-4 text-gray-500" />
                                      </button>
                                      <PencilSquareIcon className="w-4 h-4 text-gray-500" />
                                    </div>
                                  </li>
                                </SortableWrapper>
                              ))}
                          </ul>
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
      <div className="border-t border-gray-200 mt-8 pt-4">
        <h2 className="text-lg font-semibold mb-2">Live Preview</h2>
        {categories.map((cat) => (
          <div key={cat.id} className="mb-4">
            <h3 className="font-medium">{cat.name}</h3>
            <ul className="pl-4 list-disc text-sm text-gray-700">
              {items
                .filter((i) => i.category_id === cat.id)
                .map((i) => (
                  <li key={i.id} className="mb-1">
                    {i.name} – ${i.price.toFixed(2)}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <AddItemModal
        showModal={showAddModal}
        restaurantId={restaurantId!}
        defaultCategoryId={defaultCategoryId || undefined}
        item={editItem || undefined}
        onSaved={() => restaurantId && fetchData(restaurantId)}
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
          onCreated={() => restaurantId && fetchData(restaurantId)}
        />
      )}
    </DashboardLayout>
  );
}

