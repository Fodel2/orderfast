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
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
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
  const router = useRouter();

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

  if (!session) return <p>Loading session...</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Menu Builder</h1>
      <p>Manage categories and items here.</p>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>Drag categories and items to reorder.</p>
      <button
        onClick={() => {
          setEditCategory(null);
          setShowAddCatModal(true);
          console.log('showAddCatModal after click:', showAddCatModal);
        }}
        style={{ margin: '1rem 0' }}
      >
        Add New Category
      </button>

      {loading ? (
        <p>Loading...</p>
      ) : categories.length === 0 ? (
        <p>No menu categories found. Use "Add New Category" to get started.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
          <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {categories.map((cat) => (
              <SortableWrapper key={cat.id} id={cat.id}>
                <div style={{ marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ userSelect: 'none', cursor: 'grab' }}>☰</span>
                    <h2 style={{ margin: 0 }}>{cat.name}</h2>
                  </div>
                  <p>{cat.description}</p>
                  <button
                    onClick={() => {
                      setEditCategory(cat);
                      setShowAddCatModal(true);
                      console.log('showAddCatModal after click:', showAddCatModal);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{ marginBottom: '0.5rem', cursor: 'pointer' }}
                  >
                    Edit Category
                  </button>
                  <button
                    onClick={() => {
                     setDefaultCategoryId(cat.id);
                     setEditItem(null);
                     setShowAddModal(true);
                      console.log('showAddModal after click:', showAddModal);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{ marginBottom: '1rem', cursor: 'pointer' }}
                  >
                    Add New Item
                  </button>
                  <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.5rem' }}>
                    Drag items to reorder
                  </div>

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleItemDragEnd(cat.id)}
                  >
                    <SortableContext
                      items={items.filter((i) => i.category_id === cat.id).map((i) => i.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul style={{ listStyle: 'none', padding: 0 }}>
                        {items
                          .filter((item) => item.category_id === cat.id)
                          .map((item) => (
                            <SortableWrapper key={item.id} id={item.id}>
                              <li
                                /* Clicking an existing item opens the modal pre-filled for editing */
                                onClick={() => {
                                  setEditItem(item);
                                  setDefaultCategoryId(null);
                                  setShowAddModal(true);
                                  console.log('showAddModal after click:', showAddModal);
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                style={{ cursor: 'grab', padding: '0.25rem 0' }}
                              >
                                <strong>{item.name}</strong> – ${item.price.toFixed(2)}<br />
                                <small>{item.description}</small>
                              </li>
                            </SortableWrapper>
                          ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                </div>
              </SortableWrapper>
            ))}
          </SortableContext>
        </DndContext>
      )}
      <div style={{ borderTop: '1px solid #ccc', marginTop: '2rem', paddingTop: '1rem' }}>
        <h2>Live Preview</h2>
        {categories.map((cat) => (
          <div key={cat.id} style={{ marginBottom: '1rem' }}>
            <h3>{cat.name}</h3>
            <ul style={{ paddingLeft: '1rem' }}>
              {items
                .filter((i) => i.category_id === cat.id)
                .map((i) => (
                  <li key={i.id} style={{ marginBottom: '0.25rem' }}>
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
        onCreated={() => restaurantId && fetchData(restaurantId!)}
        item={editItem || undefined}
        categories={categories}
        defaultCategoryId={defaultCategoryId || undefined}
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
    </div>
  );
}
