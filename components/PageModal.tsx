import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export interface Page {
  id: string;
  title: string;
  slug: string;
  content: any;
  show_in_nav: boolean;
  sort_order: number;
}

interface PageModalProps {
  restaurantId: string | number;
  page?: Page;
  onClose: () => void;
  onSaved: () => void;
}

const slugify = (str: string) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

export default function PageModal({
  restaurantId,
  page,
  onClose,
  onSaved,
}: PageModalProps) {
  const [title, setTitle] = useState(page?.title || '');
  const [slug, setSlug] = useState(page?.slug || '');
  const [content, setContent] = useState(
    page?.content ? JSON.stringify(page.content, null, 2) : ''
  );
  const [showInNav, setShowInNav] = useState<boolean>(page?.show_in_nav ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!page) {
      setSlug(slugify(title));
    }
  }, [title, page]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    let error;
    const payload = {
      title,
      slug,
      content: content ? JSON.parse(content) : {},
      show_in_nav: showInNav,
    };
    if (page) {
      ({ error } = await supabase
        .from('custom_pages')
        .update(payload)
        .eq('id', page.id));
    } else {
      ({ error } = await supabase
        .from('custom_pages')
        .insert([{ restaurant_id: restaurantId, ...payload }]));
    }
    if (error) {
      alert('Failed to save page: ' + error.message);
      setSaving(false);
      return;
    }
    onSaved();
    onClose();
    setSaving(false);
  };

  if (!restaurantId) return null;
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-semibold mb-4">
          {page ? 'Edit Page' : 'New Page'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full border border-gray-300 rounded p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Content (JSON)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full border border-gray-300 rounded p-2 min-h-[150px]"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="show-nav"
              checked={showInNav}
              onChange={(e) => setShowInNav(e.target.checked)}
            />
            <label htmlFor="show-nav" className="text-sm">
              Show in navigation
            </label>
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-teal-600 text-teal-600 rounded hover:bg-teal-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
