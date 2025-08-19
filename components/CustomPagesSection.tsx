import { useEffect, useState } from 'react';
import {
  PencilSquareIcon,
  TrashIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline';
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

  const loadPages = async () => {
    const { data, error } = await supabase
      .from('website_pages')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .neq('status', 'archived')
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
      .from('website_pages')
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

  const togglePublished = async (p: Page, val: boolean) => {
    setPages((prev) => prev.map((pg) => (pg.id === p.id ? { ...pg, status: val ? 'published' : 'draft' } : pg)));
    const { error } = await supabase
      .from('website_pages')
      .update({ status: val ? 'published' : 'draft' })
      .eq('id', p.id);
    if (error) {
      setToastMessage('Failed to update');
    }
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
        <div className="bg-white rounded-xl shadow divide-y">
          {pages.map((p) => (
            <div key={p.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold">{p.title}</p>
                <p className="text-sm text-gray-500">{p.slug}</p>
              </div>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-1 text-sm">
                  <input
                    type="checkbox"
                    checked={p.status === 'published'}
                    onChange={(e) => togglePublished(p, e.target.checked)}
                  />
                  <span>Published</span>
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
          ))}
          {!pages.length && (
            <p className="p-4 text-gray-500 text-sm">No pages yet.</p>
          )}
        </div>
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
