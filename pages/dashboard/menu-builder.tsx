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

// Small wrapper component used for dnd-kit sortable items
function SortableWrapper({ id, children }: { id: number; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
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
  const [editItem, setEditItem] = useState<any | null>(null);
  const [defaultCategoryId, setDefaultCategoryId] = useState<number | null>(null);
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setSession(session);
        fetchData();
      }
    };

    getSession();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const { data: categoriesData, error: catError } = await supabase
      .from('menu_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    const { data: itemsData, error: itemsError } = await supabase
      .from('menu_items')
      .select('*')
      .order('sort_order', { ascending: true });

    if (catError || itemsError) {
      console.error('Error fetching data:', catError || itemsError);
    } else {
      setCategories(categoriesData);
      setItems(itemsData);
    }

    setLoading(false);
  };

  if (!session) return <p>Loading session...</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Menu Builder</h1>
      <p>Manage categories and items here.</p>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
          <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {categories.map((cat) => (
              <SortableWrapper key={cat.id} id={cat.id}>
                <div style={{ marginBottom: '2rem' }}>
                  <h2>{cat.name}</h2>
                  <p>{cat.description}</p>
                  <button
                    onClick={() => {
                      setDefaultCategoryId(cat.id);
                      setEditItem(null);
                      setShowAddModal(true);
                    }}
                    style={{ marginBottom: '1rem' }}
                  >
                    Add Item
                  </button>

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
                                onClick={() => {
                                  setEditItem(item);
                                  setDefaultCategoryId(null);
                                  setShowAddModal(true);
                                }}
                                style={{ cursor: 'pointer', padding: '0.25rem 0' }}
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
      {showAddModal && (
        <AddItemModal
          categories={categories}
          defaultCategoryId={defaultCategoryId || undefined}
          item={editItem || undefined}
          onClose={() => {
            setShowAddModal(false);
            setEditItem(null);
          }}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}
