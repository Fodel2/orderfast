import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { toast } from '@/components/ui/toast';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { SlideRenderer } from '@/components/customer/home/SlidesContainer';
import { STORAGE_BUCKET } from '@/lib/storage';
import { DndContext, closestCenter } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

function SortableImage({
  id,
  src,
  onRemove,
}: {
  id: string;
  src: string;
  onRemove: (idx: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 mb-2"
    >
      <span {...attributes} {...listeners} className="cursor-move">
        ⋮
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="w-16 h-16 object-cover rounded" />
      <button
        type="button"
        onClick={() => onRemove(Number(id))}
        className="px-1 text-sm border rounded"
      >
        x
      </button>
    </div>
  );
}

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
  const [template, setTemplate] = useState('');
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const galleryFileRef = useRef<HTMLInputElement | null>(null);
  const isEdit = !!initial?.id;
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const linkOptions = [
    { value: '/menu', label: '/menu' },
    { value: '/orders', label: '/orders' },
    { value: '/p/contact', label: '/p/contact' },
    { value: 'custom', label: 'Custom URL' },
  ];
  const [linkChoice, setLinkChoice] = useState<string>('custom');

  function applyTemplate(t: string) {
    setTemplate(t);
    switch (t) {
      case 'Solid Color':
        setTitle('Welcome');
        setSubtitle('What would you like today?');
        setCtaLabel('Order Now');
        setLinkChoice('/menu');
        setCtaHref('/menu');
        setConfigText(
          JSON.stringify(
            {
              style: {
                background: { kind: 'color', value: '#111111' },
                overlay: true,
              },
            },
            null,
            2
          )
        );
        break;
      case 'Image Background':
        setTitle('Fresh & Tasty');
        setSubtitle('Check out our menu');
        setCtaLabel('Browse Menu');
        setLinkChoice('/menu');
        setCtaHref('/menu');
        setConfigText(
          JSON.stringify(
            {
              style: {
                background: { kind: 'image', fit: 'cover', position: 'center' },
                overlay: true,
              },
            },
            null,
            2
          )
        );
        break;
      case 'Video Background':
        setTitle('See it in action');
        setSubtitle('Our kitchen in motion');
        setCtaLabel('Order Now');
        setLinkChoice('/menu');
        setCtaHref('/menu');
        setConfigText(
          JSON.stringify(
            {
              style: {
                background: {
                  kind: 'video',
                  muted: true,
                  loop: true,
                  autoplay: true,
                  fit: 'cover',
                },
                overlay: true,
              },
            },
            null,
            2
          )
        );
        break;
      case 'Gallery Row':
        setType('gallery');
        setTitle('Gallery');
        setSubtitle('A peek inside');
        setCtaLabel('');
        setLinkChoice('custom');
        setCtaHref('');
        setGalleryImages([]);
        setConfigText(JSON.stringify({ images: [] }, null, 2));
        break;
      case 'CTA Banner':
        setType('cta_banner');
        setTitle('Special Offer');
        setSubtitle('Limited time only');
        setCtaLabel('Learn More');
        setLinkChoice('/menu');
        setCtaHref('/menu');
        break;
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop();
    const path = `slides/${initial.restaurant_id}/${crypto.randomUUID()}${ext ? `.${ext}` : ''}`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: true });
    if (error) {
      const errText = [error.name, error.message].filter(Boolean).join(': ');
      toast.error('Upload failed: ' + errText);
      return;
    }
    const url = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data
      .publicUrl;
    setMediaUrl(url);
  }

  async function handleGalleryAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop();
    const path = `slides/${initial.restaurant_id}/${crypto.randomUUID()}${ext ? `.${ext}` : ''}`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: true });
    if (error) {
      const errText = [error.name, error.message].filter(Boolean).join(': ');
      toast.error('Upload failed: ' + errText);
      return;
    }
    const url = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data
      .publicUrl;
    setGalleryImages((imgs) => {
      const next = [...imgs, url];
      setConfigText(JSON.stringify({ images: next }, null, 2));
      return next;
    });
  }

  function handleGalleryDragEnd(event: any) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setGalleryImages((imgs) => {
      const next = arrayMove(imgs, Number(active.id), Number(over.id));
      setConfigText(JSON.stringify({ images: next }, null, 2));
      return next;
    });
  }

  function removeGallery(idx: number) {
    setGalleryImages((imgs) => {
      const next = imgs.filter((_, i) => i !== idx);
      setConfigText(JSON.stringify({ images: next }, null, 2));
      return next;
    });
  }

  useEffect(() => {
    if (!open) return;
    setType(initial.type || 'menu_highlight');
    setTitle(initial.title || '');
    setSubtitle(initial.subtitle || '');
    setMediaUrl(initial.media_url || '');
    setCtaLabel(initial.cta_label || '');
    setCtaHref(initial.cta_href || '');
    const lc = linkOptions.find((o) => o.value === (initial.cta_href || ''))
      ? (initial.cta_href || '')
      : 'custom';
    setLinkChoice(lc);
    if (initial.type === 'gallery') {
      const imgs = Array.isArray(initial.config_json?.images)
        ? initial.config_json.images
        : [];
      setGalleryImages(imgs);
      if (!imgs.length) setConfigText(JSON.stringify({ images: [] }, null, 2));
    }
    setVisibleFrom(initial.visible_from || '');
    setVisibleUntil(initial.visible_until || '');
    setConfigText(initial.config_json ? JSON.stringify(initial.config_json, null, 2) : '');
    setTemplate('');
    setPreviewDevice('mobile');
  }, [open, initial]);

  useEffect(() => {
    if (linkChoice !== 'custom') setCtaHref('');
  }, [linkChoice]);

  useEffect(() => {
    if (type === 'gallery') {
      try {
        const obj = configText ? JSON.parse(configText) : {};
        if (Array.isArray(obj.images)) setGalleryImages(obj.images);
      } catch {
        /* ignore */
      }
    }
  }, [type, configText]);

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
      cta_href: (linkChoice === 'custom' ? ctaHref : linkChoice) || null,
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
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl"
        style={{ maxHeight: '90vh', overflow: 'auto' }}
      >
        <h2 className="text-xl font-semibold mb-3">
          {isEdit ? 'Edit Slide' : 'New Slide'}
        </h2>
        <label className="block text-sm font-medium mb-1 flex items-center gap-1">
          Templates
          <InformationCircleIcon
            className="w-4 h-4"
            title="Pick a starting design. You can tweak the options below."
          />
        </label>
        <select
          value={template}
          onChange={(e) => applyTemplate(e.target.value)}
          className="w-full mb-3 rounded border px-3 py-2"
        >
          <option value="">--</option>
          {['Solid Color', 'Image Background', 'Video Background', 'Gallery Row', 'CTA Banner'].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="block text-sm font-medium mb-1">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full mb-3 rounded border px-3 py-2"
        >
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full mb-3 rounded border px-3 py-2"
        />
        <label className="block text-sm font-medium mb-1">Subtitle</label>
        <input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          className="w-full mb-3 rounded border px-3 py-2"
        />
        <label className="block text-sm font-medium mb-1 flex items-center gap-1">
          Background Image/Video
          <InformationCircleIcon
            className="w-4 h-4"
            title="Upload an image or short video to fill the slide background. Large files may impact load speed."
          />
        </label>
        <div className="flex gap-2 mb-3">
          <input
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            className="flex-1 rounded border px-3 py-2"
          />
          <input
            type="file"
            ref={fileRef}
            className="hidden"
            accept="image/*,video/*"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="px-3 py-2 rounded border"
          >
            Upload
          </button>
        </div>
        {mediaUrl && (
          mediaUrl.match(/\.mp4|\.webm/) ? (
            <video src={mediaUrl} className="mb-3 w-full max-h-48" autoPlay muted loop />
          ) : (
            <img src={mediaUrl} alt="" className="mb-3 w-full max-h-48 object-cover" />
          )
        )}
        {type === 'gallery' && (
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Gallery Images</label>
            <div className="mb-2">
              <input
                type="file"
                ref={galleryFileRef}
                className="hidden"
                accept="image/*"
                onChange={handleGalleryAdd}
              />
              <button
                type="button"
                onClick={() => galleryFileRef.current?.click()}
                className="px-3 py-2 rounded border"
              >
                Add Image
              </button>
            </div>
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={handleGalleryDragEnd}
            >
              <SortableContext
                items={galleryImages.map((_, i) => String(i))}
                strategy={verticalListSortingStrategy}
              >
                {galleryImages.map((src, i) => (
                  <SortableImage
                    key={i}
                    id={String(i)}
                    src={src}
                    onRemove={removeGallery}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}
        <label className="block text-sm font-medium mb-1">Button Text</label>
        <input
          value={ctaLabel}
          onChange={(e) => setCtaLabel(e.target.value)}
          className="w-full mb-3 rounded border px-3 py-2"
        />
        <label className="block text-sm font-medium mb-1 flex items-center gap-1">
          Button Link
          <InformationCircleIcon
            className="w-4 h-4"
            title="Where to send customers when they tap the button. Example: /menu or https://…"
          />
        </label>
        <select
          value={linkChoice}
          onChange={(e) => setLinkChoice(e.target.value)}
          className="w-full mb-2 rounded border px-3 py-2"
        >
          {linkOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {linkChoice === 'custom' && (
          <input
            value={ctaHref}
            onChange={(e) => setCtaHref(e.target.value)}
            className="w-full mb-3 rounded border px-3 py-2"
            placeholder="https://..."
          />
        )}
        <label className="block text-sm font-medium mb-1 flex items-center gap-1">
          Visible From
          <InformationCircleIcon
            className="w-4 h-4"
            title="Start date/time when this slide should start appearing on your site. Leave empty to start immediately."
          />
        </label>
        <input
          type="datetime-local"
          value={visibleFrom}
          onChange={(e) => setVisibleFrom(e.target.value)}
          className="w-full mb-3 rounded border px-3 py-2"
        />
        <label className="block text-sm font-medium mb-1 flex items-center gap-1">
          Visible Until
          <InformationCircleIcon
            className="w-4 h-4"
            title="End date/time when this slide should stop appearing. Leave empty for no end date."
          />
        </label>
        <input
          type="datetime-local"
          value={visibleUntil}
          onChange={(e) => setVisibleUntil(e.target.value)}
          className="w-full mb-3 rounded border px-3 py-2"
        />
        <details
          className="mb-3"
          open={showAdvanced}
          onToggle={(e) => setShowAdvanced(e.currentTarget.open)}
        >
          <summary className="cursor-pointer text-sm font-medium">
            Advanced options (JSON)
          </summary>
          <p className="text-xs mb-2">
            Optional. Raw JSON for power users (styling, galleries). You can ignore this.
          </p>
          {showAdvanced && (
            <textarea
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              rows={4}
              className="w-full rounded border px-3 py-2 font-mono"
            />
          )}
        </details>
        <div className="mb-3">
          <div className="flex gap-2 mb-2">
            {['mobile', 'tablet', 'desktop'].map((d) => (
              <button
                key={d}
                onClick={() => setPreviewDevice(d as any)}
                className={`px-2 py-1 rounded border ${
                  previewDevice === d ? 'bg-gray-200' : ''
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="flex justify-center">
            <div
              style={{
                width:
                  previewDevice === 'mobile'
                    ? 375
                    : previewDevice === 'tablet'
                    ? 768
                    : 1280,
                maxWidth: '100%',
                border: '4px solid #000',
                borderRadius: previewDevice === 'desktop' ? 8 : 20,
                overflow: 'hidden',
                transition: 'width 0.3s',
              }}
            >
              <SlideRenderer
                slide={{
                  id: initial.id || '',
                  restaurant_id: initial.restaurant_id,
                  type,
                  title,
                  subtitle,
                  media_url: mediaUrl,
                  cta_label: ctaLabel,
                  cta_href: linkChoice === 'custom' ? ctaHref : linkChoice,
                  visible_from: visibleFrom || null,
                  visible_until: visibleUntil || null,
                  is_active: true,
                  sort_order: initial.sort_order || 0,
                  config_json: (() => {
                    try {
                      return configText ? JSON.parse(configText) : null;
                    } catch {
                      return null;
                    }
                  })(),
                } as any}
                restaurantId={initial.restaurant_id}
                router={{ push: () => {} }}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded border">
            Cancel
          </button>
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

