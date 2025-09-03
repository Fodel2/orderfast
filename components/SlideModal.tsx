import React, { useEffect, useState } from 'react';
import { toast } from '@/components/ui/toast';
import { supabase } from '@/utils/supabaseClient';

type SlideModalProps = {
  open: boolean;
  onClose: () => void;
  initial: { restaurant_id: string } & Partial<{
    id: string;
    type: string;
    title: string | null;
    subtitle: string | null;
    media_url: string | null;
    cta_label: string | null;
    cta_href: string | null;
    is_active: boolean;
    visible_from: string | null;
    visible_until: string | null;
    config_json: any;
  }>;
  onSaved: () => void;
};

export default function SlideModal({ open, onClose, initial, onSaved }: SlideModalProps) {
  const [type, setType] = useState(initial.type || 'hero');
  const [title, setTitle] = useState(initial.title || '');
  const [subtitle, setSubtitle] = useState(initial.subtitle || '');
  const [mediaUrl, setMediaUrl] = useState(initial.media_url || '');
  const [ctaLabel, setCtaLabel] = useState(initial.cta_label || '');
  const [ctaHref, setCtaHref] = useState(initial.cta_href || '');
  const [isActive, setIsActive] = useState(initial.is_active ?? true);
  const [visibleFrom, setVisibleFrom] = useState(initial.visible_from || '');
  const [visibleUntil, setVisibleUntil] = useState(initial.visible_until || '');
  const [config, setConfig] = useState(() => JSON.stringify(initial.config_json || {}, null, 2));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(initial.type || 'hero');
    setTitle(initial.title || '');
    setSubtitle(initial.subtitle || '');
    setMediaUrl(initial.media_url || '');
    setCtaLabel(initial.cta_label || '');
    setCtaHref(initial.cta_href || '');
    setIsActive(initial.is_active ?? true);
    setVisibleFrom(initial.visible_from || '');
    setVisibleUntil(initial.visible_until || '');
    setConfig(JSON.stringify(initial.config_json || {}, null, 2));
  }, [open, initial]);

  async function handleSave() {
    if (!initial.restaurant_id) {
      toast.error('Missing restaurant id');
      return;
    }
    if (visibleFrom && visibleUntil && new Date(visibleUntil) < new Date(visibleFrom)) {
      toast.error('End date must be after start date');
      return;
    }
    let parsedConfig: any = null;
    try {
      parsedConfig = config ? JSON.parse(config) : null;
    } catch (e) {
      toast.error('config_json must be valid JSON');
      return;
    }
    const payload = {
      type,
      title: title || null,
      subtitle: subtitle || null,
      media_url: mediaUrl || null,
      cta_label: ctaLabel || null,
      cta_href: ctaHref || null,
      is_active: isActive,
      visible_from: visibleFrom || null,
      visible_until: visibleUntil || null,
      config_json: parsedConfig,
    };
    setSaving(true);
    try {
      if (initial.id) {
        const { error } = await supabase
          .from('restaurant_slides')
          .update(payload)
          .eq('id', initial.id);
        if (error) throw error;
      } else {
        const { data: maxRow, error: mErr } = await supabase
          .from('restaurant_slides')
          .select('sort_order')
          .eq('restaurant_id', initial.restaurant_id)
          .order('sort_order', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (mErr) throw mErr;
        const nextOrder = (maxRow?.sort_order ?? -1) + 1;
        const { error } = await supabase
          .from('restaurant_slides')
          .insert({ ...payload, restaurant_id: initial.restaurant_id, sort_order: nextOrder });
        if (error) throw error;
      }
      toast.success('Slide saved');
      onSaved();
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to save slide');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-4 shadow-lg space-y-3">
        <h2 className="text-xl font-semibold">{initial.id ? 'Edit Slide' : 'New Slide'}</h2>
        <label className="block text-sm font-medium">Type</label>
        <select value={type} onChange={e => setType(e.target.value)} className="w-full rounded border px-3 py-2">
          {['hero','menu_highlight','gallery','reviews','about','location_hours','cta_banner','custom_builder'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <label className="block text-sm font-medium">Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded border px-3 py-2" />
        <label className="block text-sm font-medium">Subtitle</label>
        <input value={subtitle} onChange={e => setSubtitle(e.target.value)} className="w-full rounded border px-3 py-2" />
        <label className="block text-sm font-medium">Media URL</label>
        <input value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} className="w-full rounded border px-3 py-2" />
        <label className="block text-sm font-medium">CTA Label</label>
        <input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} className="w-full rounded border px-3 py-2" />
        <label className="block text-sm font-medium">CTA Href</label>
        <input value={ctaHref} onChange={e => setCtaHref(e.target.value)} className="w-full rounded border px-3 py-2" />
        <label className="block text-sm font-medium flex items-center gap-2">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /> Active
        </label>
        <label className="block text-sm font-medium">Visible From</label>
        <input type="datetime-local" value={visibleFrom} onChange={e => setVisibleFrom(e.target.value)} className="w-full rounded border px-3 py-2" />
        <label className="block text-sm font-medium">Visible Until</label>
        <input type="datetime-local" value={visibleUntil} onChange={e => setVisibleUntil(e.target.value)} className="w-full rounded border px-3 py-2" />
        <label className="block text-sm font-medium">Config JSON</label>
        <textarea value={config} onChange={e => setConfig(e.target.value)} rows={4} className="w-full rounded border px-3 py-2 font-mono" />
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded border">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
