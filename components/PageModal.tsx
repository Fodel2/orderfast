import React, { useEffect, useMemo, useState } from 'react';
import { toast } from '@/components/ui/toast'; // use your existing toast util; if different, keep your import
import { supabase } from '@/utils/supabaseClient'; // use your existing client path

type PageModalProps = {
  open: boolean;
  onClose: () => void;
  initial?: {
    id?: string;
    restaurant_id: string;
    title?: string;
    slug?: string;
    content?: string; // store plain text/JSON as you already do
    show_in_nav?: boolean;
    seo_title?: string;
    seo_description?: string;
  };
  onSaved: (pageId: string) => void;
};

function slugify(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function PageModal({ open, onClose, initial, onSaved }: PageModalProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [showInNav, setShowInNav] = useState(initial?.show_in_nav ?? true);
  const [seoTitle, setSeoTitle] = useState(initial?.seo_title ?? '');
  const [seoDescription, setSeoDescription] = useState(initial?.seo_description ?? '');
  const [saving, setSaving] = useState(false);

  const isEdit = !!initial?.id;

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? '');
    setSlug(initial?.slug ?? '');
    setContent(initial?.content ?? '');
    setShowInNav(initial?.show_in_nav ?? true);
    setSeoTitle(initial?.seo_title ?? '');
    setSeoDescription(initial?.seo_description ?? '');
  }, [open, initial]);

  function ensureSlug(v: string) {
    const s = slugify(v);
    setSlug(s);
  }

  async function handleSave() {
    if (!initial?.restaurant_id) {
      toast.error('Missing restaurant_id. Please reload and try again.');
      return;
    }
    const cleanedTitle = title.trim();
    const cleanedSlug = (slug || slugify(title)).trim();

    if (!cleanedTitle) {
      toast.error('Please enter a title');
      return;
    }
    if (!cleanedSlug) {
      toast.error('Please enter a slug');
      return;
    }

    setSaving(true);
    try {
      if (isEdit && initial?.id) {
        const { error } = await supabase
          .from('custom_pages')
          .update({
            title: cleanedTitle,
            slug: cleanedSlug,
            content,
            show_in_nav: showInNav,
            seo_title: seoTitle || null,
            seo_description: seoDescription || null,
          })
          .eq('id', initial.id)
          .select('id')
          .single();

        if (error) throw error;
        toast.success('Page updated');
        onSaved(initial.id);
      } else {
        // sort_order = max+1
        const { data: maxRow, error: maxErr } = await supabase
          .from('custom_pages')
          .select('sort_order')
          .eq('restaurant_id', initial!.restaurant_id)
          .order('sort_order', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (maxErr) throw maxErr;

        const nextOrder = (maxRow?.sort_order ?? -1) + 1;

        const { data, error } = await supabase
          .from('custom_pages')
          .insert({
            restaurant_id: initial!.restaurant_id,
            title: cleanedTitle,
            slug: cleanedSlug,
            content,
            show_in_nav: showInNav,
            sort_order: nextOrder,
            seo_title: seoTitle || null,
            seo_description: seoDescription || null,
          })
          .select('id')
          .single();

        if (error) throw error;
        toast.success('Page created');
        onSaved(data.id);
      }
      onClose();
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.code === '23505'
          ? 'That slug already exists. Please choose another.'
          : e?.message || 'Failed to save page';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-2xl bg-white p-4 shadow-xl">
        <h2 className="text-xl font-semibold mb-3">{isEdit ? 'Edit Page' : 'New Page'}</h2>

        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!isEdit) ensureSlug(e.target.value);
          }}
          className="w-full mb-3 rounded border px-3 py-2"
          placeholder="e.g. About Us"
        />

        <label className="block text-sm font-medium mb-1">Slug</label>
        <input
          value={slug}
          onChange={(e) => setSlug(slugify(e.target.value))}
          className="w-full mb-3 rounded border px-3 py-2"
          placeholder="about-us"
        />

        <label className="block text-sm font-medium mb-1">Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          className="w-full mb-3 rounded border px-3 py-2 font-mono"
          placeholder="Write content or JSON (temporary)."
        />

        <div className="mb-3 flex items-center gap-2">
          <input
            id="show_in_nav"
            type="checkbox"
            checked={showInNav}
            onChange={(e) => setShowInNav(e.target.checked)}
          />
          <label htmlFor="show_in_nav">Show in navigation</label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">SEO Title (optional)</label>
            <input
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">SEO Description (optional)</label>
            <input
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded border">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
