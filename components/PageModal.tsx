import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export interface Page {
  id: number;
  title: string;
  slug: string;
  content: string;
  published: boolean;
}

interface PageModalProps {
  restaurantId: number;
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
  const [content, setContent] = useState(page?.content || '');
  const [published, setPublished] = useState(page?.published ?? true);
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
    if (page) {
      ({ error } = await supabase
        .from('restaurant_pages')
        .update({ title, slug, content, published })
        .eq('id', page.id));
    } else {
      ({ error } = await supabase.from('restaurant_pages').insert([
        { restaurant_id: restaurantId, title, slug, content, published },
      ]));
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
            <label className="block text-sm font-medium mb-1">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full border border-gray-300 rounded p-2 min-h-[150px]"
            />
          </div>
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
            />
            <span>Published</span>
          </label>
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
