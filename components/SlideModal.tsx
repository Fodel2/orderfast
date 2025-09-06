import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { toast } from '@/components/ui/toast';

const typeOptions = [
  'menu_highlight',
  'gallery',
  'reviews',
  'about',
  'location_hours',
  'cta_banner',
  'custom_builder',
];

export type SlideRow = {
  id?: string;
  restaurant_id: string;
  type: string;
  title?: string | null;
  subtitle?: string | null;
  media_url?: string | null;
  cta_label?: string | null;
  cta_href?: string | null;
  visible_from?: string | null;
  visible_until?: string | null;
  config_json?: any;
  sort_order?: number;
  is_active?: boolean;
};

export default function SlideModal({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial: SlideRow;
  onSaved: () => void;
}) {
  const [type, setType] = useState<string>('menu_highlight');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaHref, setCtaHref] = useState('');
  const [visibleFrom, setVisibleFrom] = useState('');
  const [visibleUntil, setVisibleUntil] = useState('');
  const [configText, setConfigText] = useState('');
  const isEdit = !!initial?.id;
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(initial.type || 'menu_highlight');
    setTitle(initial.title || '');
    setSubtitle(initial.subtitle || '');
    setMediaUrl(initial.media_url || '');
    setCtaLabel(initial.cta_label || '');
    setCtaHref(initial.cta_href || '');
    setVisibleFrom(initial.visible_from || '');
    setVisibleUntil(initial.visible_until || '');
    setConfigText(initial.config_json ? JSON.stringify(initial.config_json, null, 2) : '');
  }, [open, initial]);

  async function handleSave() {
    if (visibleFrom && visibleUntil && new Date(visibleUntil) < new Date(visibleFrom)) {
      toast.error('visible_until must be after visible_from');
      return;
    }
    let cfg: any = null;
    if (configText.trim()) {
      try {
        cfg = JSON.parse(configText);
      } catch (e) {
        toast.error('config_json must be valid JSON');
        return;
      }
    }
    const payload: SlideRow = {
      restaurant_id: initial.restaurant_id,
      type,
      title: title || null,
      subtitle: subtitle || null,
      media_url: mediaUrl || null,
      cta_label: ctaLabel || null,
      cta_href: ctaHref || null,
      visible_from: visibleFrom || null,
      visible_until: visibleUntil || null,
      config_json: cfg,
      is_active: true,
    };
    setSaving(true);
    try {
      if (isEdit && initial.id) {
        const { error } = await supabase
          .from('restaurant_slides')
          .update(payload)
          .eq('id', initial.id)
          .eq('restaurant_id', initial.restaurant_id);
        if (error) throw error;
      } else {
        const { data: maxRow, error: maxErr } = await supabase
          .from('restaurant_slides')
          .select('sort_order')
          .eq('restaurant_id', initial.restaurant_id)
          .order('sort_order', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (maxErr) throw maxErr;
        const nextOrder = (maxRow?.sort_order ?? -1) + 1;
        const { error } = await supabase.from('restaurant_slides').insert({
          ...payload,
          sort_order: nextOrder,
        });
        if (error) throw error;
      }
      toast.success('Saved');
      onSaved();
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl">
        <h2 className="text-xl font-semibold mb-3">{isEdit ? 'Edit Slide' : 'New Slide'}</h2>
        <label className="block text-sm font-medium mb-1">Type</label>
        <select value={type} onChange={(e)=>setType(e.target.value)} className="w-full mb-3 rounded border px-3 py-2">
          {typeOptions.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input value={title} onChange={e=>setTitle(e.target.value)} className="w-full mb-3 rounded border px-3 py-2" />
        <label className="block text-sm font-medium mb-1">Subtitle</label>
        <input value={subtitle} onChange={e=>setSubtitle(e.target.value)} className="w-full mb-3 rounded border px-3 py-2" />
        <label className="block text-sm font-medium mb-1">Media URL</label>
        <input value={mediaUrl} onChange={e=>setMediaUrl(e.target.value)} className="w-full mb-3 rounded border px-3 py-2" />
        <label className="block text-sm font-medium mb-1">CTA Label</label>
        <input value={ctaLabel} onChange={e=>setCtaLabel(e.target.value)} className="w-full mb-3 rounded border px-3 py-2" />
        <label className="block text-sm font-medium mb-1">CTA Href</label>
        <input value={ctaHref} onChange={e=>setCtaHref(e.target.value)} className="w-full mb-3 rounded border px-3 py-2" />
        <label className="block text-sm font-medium mb-1">Visible From</label>
        <input type="datetime-local" value={visibleFrom} onChange={e=>setVisibleFrom(e.target.value)} className="w-full mb-3 rounded border px-3 py-2" />
        <label className="block text-sm font-medium mb-1">Visible Until</label>
        <input type="datetime-local" value={visibleUntil} onChange={e=>setVisibleUntil(e.target.value)} className="w-full mb-3 rounded border px-3 py-2" />
        <label className="block text-sm font-medium mb-1">config_json</label>
        <textarea value={configText} onChange={e=>setConfigText(e.target.value)} rows={4} className="w-full mb-3 rounded border px-3 py-2 font-mono" />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded border">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

