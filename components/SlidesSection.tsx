import React, { useEffect, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '@/utils/supabaseClient';
import { toast } from '@/components/ui/toast';
import SlideModal from './SlideModal';

type SlideRow = {
  id: string;
  type: string;
  title: string | null;
  sort_order: number | null;
  is_active: boolean;
  visible_from: string | null;
  visible_until: string | null;
};

function RowHandle({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="flex items-center gap-3 p-2" >
      {children}
    </div>
  );
}

export default function SlidesSection({ restaurantId }: { restaurantId: string }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [slides, setSlides] = useState<SlideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<SlideRow | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('restaurant_slides')
      .select('id,type,title,sort_order,is_active,visible_from,visible_until')
      .eq('restaurant_id', restaurantId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) {
      console.error(error);
      toast.error('Failed to load slides');
    } else {
      setSlides(data || []);
    }
    setLoading(false);
  }

  useEffect(() => { if (restaurantId) load(); }, [restaurantId]);

  async function toggle(row: SlideRow) {
    const prev = slides;
    setSlides(prev.map(s => s.id === row.id ? { ...s, is_active: !row.is_active } : s));
    const { error } = await supabase
      .from('restaurant_slides')
      .update({ is_active: !row.is_active })
      .eq('id', row.id);
    if (error) {
      console.error(error);
      toast.error('Failed to update');
      setSlides(prev);
    }
  }

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = slides.findIndex(s => s.id === active.id);
    const newIndex = slides.findIndex(s => s.id === over.id);
    const reordered = arrayMove(slides, oldIndex, newIndex).map((s, i) => ({ ...s, sort_order: i }));
    setSlides(reordered);
    const updates = reordered.map(s => supabase.from('restaurant_slides').update({ sort_order: s.sort_order }).eq('id', s.id));
    const results = await Promise.all(updates);
    const err = results.find(r => (r as any).error);
    if (err) {
      console.error(err);
      toast.error('Failed to reorder');
      load();
    } else {
      toast.success('Order updated');
    }
  }

  async function remove(row: SlideRow) {
    if (!confirm('Delete this slide?')) return;
    const prev = slides;
    setSlides(prev.filter(s => s.id !== row.id));
    const { error } = await supabase.from('restaurant_slides').delete().eq('id', row.id);
    if (error) {
      console.error(error);
      toast.error('Failed to delete');
      setSlides(prev);
    }
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Homepage Slides</h3>
        <button onClick={() => { setEditRow(null); setModalOpen(true); }} className="px-3 py-2 rounded bg-emerald-600 text-white">+ New Slide</button>
      </div>
      {loading ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : slides.length === 0 ? (
        <div className="rounded border p-4 text-sm text-neutral-500">No slides yet.</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={slides.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y rounded border">
              {slides.map(s => (
                <RowHandle key={s.id} id={s.id}>
                  <div className="w-4 cursor-grab text-neutral-400">☰</div>
                  <div className="flex-1">
                    <div className="font-medium">{s.title || '(untitled)'}</div>
                    <div className="text-xs text-neutral-500">{s.type}</div>
                  </div>
                  <label className="flex items-center gap-1 text-sm mr-2">
                    <input type="checkbox" checked={s.is_active} onChange={() => toggle(s)} /> active
                  </label>
                  <div className="text-xs w-48 mr-2">
                    {s.visible_from ? new Date(s.visible_from).toLocaleDateString() : ''}
                    {s.visible_until ? ` – ${new Date(s.visible_until).toLocaleDateString()}` : ''}
                  </div>
                  <button onClick={() => { setEditRow(s); setModalOpen(true); }} className="px-2 py-1 rounded border mr-2">Edit</button>
                  <button onClick={() => remove(s)} className="px-2 py-1 rounded border text-red-600">Delete</button>
                </RowHandle>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <SlideModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editRow ? { ...editRow, restaurant_id: restaurantId } : { restaurant_id: restaurantId }}
        onSaved={load}
      />
    </section>
  );
}
