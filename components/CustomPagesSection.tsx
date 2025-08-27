import { useEffect, useState } from 'react';
import {
  PencilSquareIcon,
  TrashIcon,
  PlusCircleIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '../utils/supabaseClient';
import PageModal, { Page } from './PageModal';
import ConfirmModal from './ConfirmModal';
import Toast from './Toast';

export default function CustomPagesSection({
  restaurantId,
}: {
  restaurantId: string | number;
}) {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Page | null>(null);
  const [confirmDel, setConfirmDel] = useState<Page | null>(null);
  const [toastMessage, setToastMessage] = useState('');

  const sensors = useSensors(useSensor(PointerSensor));

  const loadPages = async () => {
    const { data, error } = await supabase
      .from('custom_pages')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('sort_order', { ascending: true, nullsFirst: true });
    if (error) {
      console.error(error);
      setToastMessage('Failed to load pages');
    } else {
      setPages((data as Page[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (restaurantId) loadPages();
  }, [restaurantId]);

  const handleSaved = () => {
    setShowModal(false);
    setEditing(null);
    loadPages();
    setToastMessage('Page saved');
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    const { error } = await supabase
      .from('custom_pages')
      .delete()
      .eq('id', confirmDel.id);
    if (error) {
      setToastMessage('Failed to delete page');
    } else {
      setPages((prev) => prev.filter((p) => p.id !== confirmDel.id));
      setToastMessage('Page deleted');
    }
    setConfirmDel(null);
  };

  const toggleNav = async (p: Page, val: boolean) => {
    setPages((prev) =>
      prev.map((pg) => (pg.id === p.id ? { ...pg, show_in_nav: val } : pg))
    );
    const { error } = await supabase
      .from('custom_pages')
      .update({ show_in_nav: val })
      .eq('id', p.id);
    if (error) {
      setToastMessage('Failed to update');
    }
  };

  const SortableItem = ({
    id,
    children,
  }: {
    id: string;
    children: (
      props: {
        setNodeRef: (node: HTMLElement | null) => void;
        style: React.CSSProperties;
        attributes: any;
        listeners: any;
      }
    ) => JSX.Element;
  }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    } as React.CSSProperties;
    return children({ setNodeRef, style, attributes, listeners });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex = pages.findIndex((p) => p.id === over.id);
    const newPages = arrayMove(pages, oldIndex, newIndex).map((p, i) => ({
      ...p,
      sort_order: i,
    }));
    setPages(newPages);
    await Promise.all(
      newPages.map((p) =>
        supabase
          .from('custom_pages')
          .update({ sort_order: p.sort_order })
          .eq('id', p.id)
      )
    );
  };

  return (
    <div className="max-w-2xl mx-auto mt-12">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Custom Pages</h2>
        <button
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
          className="flex items-center bg-teal-600 text-white px-3 py-2 rounded-lg hover:bg-teal-700"
        >
          <PlusCircleIcon className="w-5 h-5 mr-1" /> New Page
        </button>
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="bg-white rounded-xl shadow divide-y">
              {pages.map((p) => (
                <SortableItem key={p.id} id={p.id}>
                  {({ setNodeRef, style, attributes, listeners }) => (
                    <div
                      ref={setNodeRef}
                      style={style}
                      className="p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <span
                          {...attributes}
                          {...listeners}
                          className="cursor-grab text-gray-400"
                        >
                          <Bars3Icon className="w-4 h-4" />
                        </span>
                        <div>
                          <p className="font-semibold">{p.title}</p>
                          <p className="text-sm text-gray-500">{p.slug}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center space-x-1 text-sm">
                          <input
                            type="checkbox"
                            checked={p.show_in_nav}
                            onChange={(e) => toggleNav(p, e.target.checked)}
                          />
                          <span>In nav</span>
                        </label>
                        <button
                          onClick={() => {
                            setEditing(p);
                            setShowModal(true);
                          }}
                          className="p-2 rounded hover:bg-gray-100"
                          aria-label="Edit"
                        >
                          <PencilSquareIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setConfirmDel(p)}
                          className="p-2 rounded hover:bg-gray-100"
                          aria-label="Delete"
                        >
                          <TrashIcon className="w-5 h-5 text-red-600" />
                        </button>
                      </div>
                    </div>
                  )}
                </SortableItem>
              ))}
              {!pages.length && (
                <p className="p-4 text-gray-500 text-sm">No pages yet.</p>
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}
      {showModal && (
        <PageModal
          restaurantId={restaurantId}
          page={editing || undefined}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      )}
      {confirmDel && (
        <ConfirmModal
          show={true}
          title="Delete Page?"
          message={`Are you sure you want to delete \"${confirmDel.title}\"?`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDel(null)}
        />
      )}
      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </div>
  );
}
