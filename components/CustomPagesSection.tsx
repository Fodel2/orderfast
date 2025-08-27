import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/utils/supabaseClient'; // keep your existing path
import PageModal from './PageModal';
import { toast } from '@/components/ui/toast'; // keep your existing toast

type PageRow = {
  id: string;
  restaurant_id: string;
  title: string;
  slug: string;
  show_in_nav: boolean;
  sort_order: number;
};

export default function CustomPagesSection({ restaurantId }: { restaurantId: string }) {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<PageRow | null>(null);

  async function loadPages() {
    if (!restaurantId) {
      setLoading(false);
      toast.error('Missing restaurant id');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('custom_pages')
      .select('id, restaurant_id, title, slug, show_in_nav, sort_order')
      .eq('restaurant_id', restaurantId)
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true });

    if (error) {
      console.error(error);
      toast.error('Failed to load pages');
    } else {
      setPages(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  function openCreate() {
    setEditRow(null);
    setModalOpen(true);
  }

  function openEdit(row: PageRow) {
    setEditRow(row);
    setModalOpen(true);
  }

  async function toggleVisibility(row: PageRow) {
    const optimistic = pages.map(p => p.id === row.id ? { ...p, show_in_nav: !row.show_in_nav } : p);
    setPages(optimistic);
    const { error } = await supabase
      .from('custom_pages')
      .update({ show_in_nav: !row.show_in_nav })
      .eq('id', row.id);
    if (error) {
      console.error(error);
      toast.error('Failed to update visibility');
      setPages(pages); // rollback
    }
  }

  async function remove(row: PageRow) {
    if (!confirm('Delete this page? This cannot be undone.')) return;
    const prev = pages;
    setPages(prev.filter(p => p.id !== row.id));
    const { error } = await supabase.from('custom_pages').delete().eq('id', row.id);
    if (error) {
      console.error(error);
      toast.error('Failed to delete page');
      setPages(prev); // rollback
    } else {
      toast.success('Page deleted');
    }
  }

  async function move(row: PageRow, direction: -1 | 1) {
    const idx = pages.findIndex(p => p.id === row.id);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= pages.length) return;
    const reordered = [...pages];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(newIdx, 0, moved);
    // reindex
    const withOrder = reordered.map((p, i) => ({ ...p, sort_order: i }));
    setPages(withOrder);
    // persist
    const updates = withOrder.map(p =>
      supabase.from('custom_pages').update({ sort_order: p.sort_order }).eq('id', p.id)
    );
    const results = await Promise.all(updates);
    const anyError = results.find(r => (r as any)?.error);
    if (anyError) {
      console.error(anyError);
      toast.error('Failed to reorder pages');
      loadPages(); // reload authoritative order
    } else {
      toast.success('Order updated');
    }
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Custom Pages</h3>
        <button onClick={openCreate} className="px-3 py-2 rounded bg-emerald-600 text-white">
          + New Page
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-neutral-500">Loading pages…</div>
      ) : pages.length === 0 ? (
        <div className="rounded border p-4 text-sm text-neutral-500">No pages yet.</div>
      ) : (
        <ul className="divide-y rounded border">
          {pages.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 p-3">
              <div className="text-sm w-8 text-center select-none">
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="font-medium">{p.title}</div>
                <div className="text-xs text-neutral-500">/{p.slug}</div>
              </div>
              <button
                onClick={() => move(p, -1)}
                className="px-2 py-1 rounded border"
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                onClick={() => move(p, 1)}
                className="px-2 py-1 rounded border"
                aria-label="Move down"
              >
                ↓
              </button>
              <label className="ml-3 inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={p.show_in_nav}
                  onChange={() => toggleVisibility(p)}
                />
                Visible
              </label>
              <button onClick={() => openEdit(p)} className="ml-3 px-3 py-1 rounded border">
                Edit
              </button>
              <button onClick={() => remove(p)} className="ml-2 px-3 py-1 rounded border text-red-600">
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <PageModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editRow ? editRow : { restaurant_id: restaurantId }}
        onSaved={() => loadPages()}
      />
    </section>
  );
}
