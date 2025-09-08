import React, { useEffect, useRef, useState } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '@/utils/supabaseClient';
import { toast } from '@/components/ui/toast';
import Button from '@/components/ui/Button';
import { SlideRenderer, SlideRow } from '@/components/customer/home/SlidesContainer';
import { STORAGE_BUCKET } from '@/lib/storage';
import Skeleton from '@/components/ui/Skeleton';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

// slide config types
export type SlideConfig = {
  background?: {
    kind: 'color' | 'image' | 'video';
    value?: string;
    fit?: 'cover' | 'contain';
    position?: 'center' | 'top' | 'bottom';
    muted?: boolean;
    loop?: boolean;
    autoplay?: boolean;
    overlay?: boolean;
    overlayColor?: string;
    overlayOpacity?: number;
  };
  blocks: (
    | { id: string; type: 'heading'; text: string; align?: 'left' | 'center' | 'right' }
    | { id: string; type: 'subheading'; text: string; align?: 'left' | 'center' | 'right' }
    | { id: string; type: 'button'; text: string; href: string }
    | { id: string; type: 'image'; url: string; width?: number; height?: number }
    | { id: string; type: 'quote'; text: string; author?: string }
    | { id: string; type: 'gallery'; images: string[] }
    | { id: string; type: 'spacer'; size?: 'sm' | 'md' | 'lg' }
  )[];
  layout?: 'split';
};

export function coerceConfig(raw: any): SlideConfig {
  const cfg = raw && typeof raw === 'object' ? raw : {};
  if (!cfg.background)
    cfg.background = { kind: 'color', value: '#111', overlay: false };
  if (!Array.isArray(cfg.blocks)) cfg.blocks = [];
  return cfg as SlideConfig;
}

const defaultConfig: SlideConfig = coerceConfig({});

const knownRoutes = ['/menu', '/orders', '/p/contact'];

function SortableBlock({ block, onSelect, selected, onDelete, onMove, index, lastIndex }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: block.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-2 border rounded mb-2 ${selected ? 'bg-neutral-100' : ''}`}
      onClick={() => onSelect(block.id)}
      {...attributes}
      {...listeners}
    >
      <span className="flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMove(block.id, 'up');
          }}
          disabled={index === 0}
          className="p-0.5"
        >
          <ChevronUpIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMove(block.id, 'down');
          }}
          disabled={index === lastIndex}
          className="p-0.5"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </button>
        {block.type}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(block.id);
        }}
        className="text-sm px-1 border rounded"
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
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaHref, setCtaHref] = useState('');
  const [visibleFrom, setVisibleFrom] = useState('');
  const [visibleUntil, setVisibleUntil] = useState('');
  const [config, setConfig] = useState<SlideConfig>(defaultConfig);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  const [linkChoice, setLinkChoice] = useState('custom');
  const [customPages, setCustomPages] = useState<string[]>([]);
  const [template, setTemplate] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const imageRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const isEdit = !!initial?.id;
  const restaurantId = initial.restaurant_id;

  useEffect(() => {
    if (!open) return;
    setType(initial.type);
    setTitle(initial.title || '');
    setSubtitle(initial.subtitle || '');
    setCtaLabel(initial.cta_label || '');
    setCtaHref(initial.cta_href || '');
    setVisibleFrom(initial.visible_from || '');
    setVisibleUntil(initial.visible_until || '');
    const cfg = coerceConfig(initial.config_json);
    console.log('open cfg', cfg);
    setConfig(cfg);
    setSelectedId(null);
  }, [open, initial]);

  useEffect(() => {
    if (!restaurantId) return;
    supabase
      .from('custom_pages')
      .select('slug')
      .eq('restaurant_id', restaurantId)
      .then(({ data }) => setCustomPages(data?.map((d) => `/p/${d.slug}`) || []));
  }, [restaurantId]);

  function addBlock(type: any) {
    const id = crypto.randomUUID();
    const block: any = { id, type };
    if (type === 'heading' || type === 'subheading') block.text = type;
    if (type === 'button') block.text = 'Click Me';
    if (type === 'button') block.href = '/menu';
    if (type === 'image') block.url = '';
    if (type === 'quote') block.text = 'Quote';
    if (type === 'gallery') block.images = [];
    if (type === 'spacer') block.size = 'md';
    setConfig((c) => ({ ...c, blocks: [...c.blocks, block] }));
    setSelectedId(id);
  }

  function updateBlock(id: string, patch: any) {
    setConfig((c) => ({
      ...c,
      blocks: c.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }

  function deleteBlock(id: string) {
    setConfig((c) => ({ ...c, blocks: c.blocks.filter((b) => b.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  }

  function moveBlock(id: string, dir: 'up' | 'down') {
    setConfig((c) => {
      const idx = c.blocks.findIndex((b) => b.id === id);
      const swap = dir === 'up' ? idx - 1 : idx + 1;
      if (idx === -1 || swap < 0 || swap >= c.blocks.length) return c;
      const blocks = [...c.blocks];
      [blocks[idx], blocks[swap]] = [blocks[swap], blocks[idx]];
      return { ...c, blocks };
    });
  }

  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = config.blocks.findIndex((b) => b.id === active.id);
    const newIndex = config.blocks.findIndex((b) => b.id === over.id);
    setConfig((c) => ({ ...c, blocks: arrayMove(c.blocks, oldIndex, newIndex) }));
  }

  async function uploadFile(file: File, cb: (url: string) => void) {
    setUploading(true);
    setUploadPct(0);
    const ext = file.name.split('.').pop();
    const path = `slides/${restaurantId}/${crypto.randomUUID()}.${ext}`;
    try {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
          upsert: true,
        });
      if (error) throw error;
      const { data: pub } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(data.path);
      setUploadPct(100);
      cb(pub.publicUrl);
    } catch (err: any) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      setUploadPct(null);
    }
  }

  async function handleSave() {
    if (visibleFrom && visibleUntil && visibleUntil < visibleFrom) {
      toast.error('Visible Until must be after Visible From');
      return;
    }
    const payload: Partial<SlideRow> = {
      restaurant_id: restaurantId,
      type,
      title,
      subtitle,
      cta_label: ctaLabel,
      cta_href: ctaHref,
      visible_from: visibleFrom || null,
      visible_until: visibleUntil || null,
      media_url:
        config.background?.kind && config.background.kind !== 'color'
          ? config.background.value || null
          : null,
      config_json: config,
    };
    if (isEdit) {
      const { error } = await supabase
        .from('restaurant_slides')
        .update(payload)
        .eq('id', initial.id!)
        .eq('restaurant_id', restaurantId);
      if (error) {
        toast.error('Failed to save');
        return;
      }
    } else {
      const { data: max, error: maxErr } = await supabase
        .from('restaurant_slides')
        .select('sort_order')
        .eq('restaurant_id', restaurantId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (maxErr) {
        toast.error('Failed');
        return;
      }
      const sort_order = (max?.sort_order ?? -1) + 1;
      const { error } = await supabase
        .from('restaurant_slides')
        .insert({ ...payload, sort_order });
      if (error) {
        toast.error('Failed to create');
        return;
      }
    }
    console.log({ id: initial.id, type, blocks: config.blocks.map((b) => b.type), bg: config.background?.kind });
    onSaved();
    onClose();
  }

  const selectedBlock = config.blocks.find((b) => b.id === selectedId);

  const linkOptions = [...knownRoutes, ...customPages, 'custom'];
  useEffect(() => {
    if (selectedBlock && selectedBlock.type === 'button') {
      if (linkOptions.includes(selectedBlock.href)) setLinkChoice(selectedBlock.href);
      else setLinkChoice('custom');
    }
  }, [selectedBlock, linkOptions]);

  if (!open) return null;

  const widthMap: any = { mobile: 375, tablet: 768, desktop: 1280 };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded p-4 w-full max-w-5xl" style={{ maxHeight: '90vh', overflow: 'auto' }}>
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-semibold">Slide Editor</h2>
          <button onClick={onClose}>×</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="mb-2">
              <select
                value={template}
                onChange={(e) => {
                  const t = e.target.value;
                  setTemplate(t);
                  switch (t) {
                    case 'hero':
                      setConfig({
                        background: {
                          kind: 'image',
                          fit: 'cover',
                          position: 'center',
                          overlay: true,
                          overlayColor: '#000',
                          overlayOpacity: 0.25,
                        },
                        blocks: [
                          { id: crypto.randomUUID(), type: 'heading', text: 'Welcome' },
                          {
                            id: crypto.randomUUID(),
                            type: 'subheading',
                            text: 'Fresh, local & fast',
                          },
                          {
                            id: crypto.randomUUID(),
                            type: 'button',
                            text: 'Order Now',
                            href: '/menu',
                          },
                        ],
                      });
                      break;
                    case 'quote':
                      setConfig({
                        background: { kind: 'color', value: '#fff' },
                        blocks: [
                          {
                            id: crypto.randomUUID(),
                            type: 'quote',
                            text: 'Best food in town!',
                            author: 'Happy Customer',
                          },
                        ],
                      });
                      break;
                    case 'gallery':
                      setConfig({
                        background: { kind: 'color', value: '#fff' },
                        blocks: [
                          {
                            id: crypto.randomUUID(),
                            type: 'gallery',
                            images: [
                              'https://placehold.co/200',
                              'https://placehold.co/200',
                              'https://placehold.co/200',
                            ],
                          },
                        ],
                      });
                      break;
                    case 'split':
                      setConfig({
                        background: { kind: 'color', value: '#fff' },
                        blocks: [
                          { id: crypto.randomUUID(), type: 'image', url: '' },
                          { id: crypto.randomUUID(), type: 'heading', text: 'Your headline' },
                        ],
                        layout: 'split',
                      });
                      break;
                    case 'cta':
                      setConfig({
                        background: { kind: 'color', value: '#111', overlay: false },
                        blocks: [
                          { id: crypto.randomUUID(), type: 'heading', text: 'Specials Tonight' },
                          {
                            id: crypto.randomUUID(),
                            type: 'button',
                            text: 'Browse Menu',
                            href: '/menu',
                          },
                        ],
                      });
                      break;
                    default:
                      break;
                  }
                }}
                className="border p-1 rounded w-full mb-2"
              >
                <option value="">Templates…</option>
                <option value="hero">Hero with Button</option>
                <option value="quote">Simple Quote</option>
                <option value="gallery">Gallery Row</option>
                <option value="split">Split Column</option>
                <option value="cta">CTA Banner</option>
              </select>
            </div>
            <div className="mb-2 flex flex-wrap gap-2">
              {[
                'heading',
                'subheading',
                'button',
                'image',
                'quote',
                'gallery',
                'spacer',
              ].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addBlock(t)}
                  className="px-2 py-1 border rounded text-sm"
                >
                  Add {t}
                </button>
              ))}
            </div>
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={config.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                {config.blocks.map((b, i) => (
                  <SortableBlock
                    key={b.id}
                    block={b}
                    onSelect={setSelectedId}
                    selected={b.id === selectedId}
                    onDelete={deleteBlock}
                    onMove={moveBlock}
                    index={i}
                    lastIndex={config.blocks.length - 1}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
          <div className="space-y-4">
            {/* Background controls */}
            <div className="border p-2 rounded">
              <h3 className="font-medium mb-2">Background</h3>
              <select
                value={config.background?.kind}
                onChange={(e) =>
                  setConfig({ ...config, background: { ...config.background!, kind: e.target.value as any } })
                }
                className="border p-1 rounded w-full mb-2"
              >
                <option value="color">Color</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
              {config.background?.kind === 'color' && (
                <input
                  type="text"
                  value={config.background?.value || ''}
                  onChange={(e) =>
                    setConfig({ ...config, background: { ...config.background!, value: e.target.value } })
                  }
                  className="border p-1 rounded w-full"
                />
              )}
              {config.background?.kind !== 'color' && (
                <div className="space-y-1">
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadFile(f, (url) =>
                        setConfig({ ...config, background: { ...config.background!, value: url } })
                      );
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="px-2 py-1 border rounded text-sm"
                  >
                    Upload
                  </button>
                  {uploading && <Skeleton className="h-4 w-4 inline-block ml-2" />}
                  {uploadPct !== null && <span className="text-xs ml-1">{uploadPct}%</span>}
                  {config.background?.value && (
                    <div className="text-xs break-all">{config.background.value}</div>
                  )}
                </div>
              )}
              <label className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.background?.overlay || false}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      background: { ...config.background!, overlay: e.target.checked },
                    })
                  }
                />
                Overlay
              </label>
              {config.background?.overlay && (
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    placeholder="#000"
                    value={config.background?.overlayColor || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        background: { ...config.background!, overlayColor: e.target.value },
                      })
                    }
                    className="border p-1 rounded flex-1"
                  />
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="0.6"
                    value={config.background?.overlayOpacity ?? 0.25}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        background: {
                          ...config.background!,
                          overlayOpacity: parseFloat(e.target.value),
                        },
                      })
                    }
                    className="border p-1 rounded w-20"
                  />
                </div>
              )}
            </div>

            {/* Block properties */}
            {selectedBlock && (
              <div className="border p-2 rounded">
                <h3 className="font-medium mb-2">Block</h3>
                {selectedBlock.type === 'heading' || selectedBlock.type === 'subheading' ? (
                  <input
                    type="text"
                    value={selectedBlock.text}
                    onChange={(e) => updateBlock(selectedBlock.id, { text: e.target.value })}
                    className="border p-1 rounded w-full mb-2"
                  />
                ) : null}
                {selectedBlock.type === 'button' && (
                  <>
                    <input
                      type="text"
                      value={selectedBlock.text}
                      onChange={(e) => updateBlock(selectedBlock.id, { text: e.target.value })}
                      className="border p-1 rounded w-full mb-2"
                    />
                    <select
                      value={linkChoice}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLinkChoice(v);
                        if (v === 'custom') updateBlock(selectedBlock.id, { href: '' });
                        else updateBlock(selectedBlock.id, { href: v });
                      }}
                      className="border p-1 rounded w-full mb-2"
                    >
                      {linkOptions.map((o) => (
                        <option key={o} value={o}>
                          {o === 'custom' ? 'Custom URL…' : o}
                        </option>
                      ))}
                    </select>
                    {linkChoice === 'custom' && (
                      <input
                        type="text"
                        value={selectedBlock.href || ''}
                        onChange={(e) => updateBlock(selectedBlock.id, { href: e.target.value })}
                        className="border p-1 rounded w-full mb-2"
                      />
                    )}
                  </>
                )}
                {selectedBlock.type === 'image' && (
                  <div className="space-y-2">
                    <input
                      ref={imageRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f)
                          uploadFile(f, (url) => updateBlock(selectedBlock.id, { url }));
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => imageRef.current?.click()}
                      className="px-2 py-1 border rounded text-sm"
                    >
                      Upload
                    </button>
                    {uploading && <Skeleton className="h-4 w-4 inline-block ml-2" />}
                    {uploadPct !== null && <span className="text-xs ml-1">{uploadPct}%</span>}
                    {selectedBlock.url && (
                      <div className="text-xs break-all">{selectedBlock.url}</div>
                    )}
                  </div>
                )}
                {selectedBlock.type === 'gallery' && (
                  <div className="space-y-2">
                    <input
                      ref={galleryRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        files.forEach((f) =>
                          uploadFile(f, (url) =>
                            updateBlock(selectedBlock.id, {
                              images: [...selectedBlock.images, url],
                            })
                          )
                        );
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => galleryRef.current?.click()}
                      className="px-2 py-1 border rounded text-sm"
                    >
                      Upload Images
                    </button>
                    {uploading && <Skeleton className="h-4 w-4 inline-block ml-2" />}
                    {uploadPct !== null && <span className="text-xs ml-1">{uploadPct}%</span>}
                    {selectedBlock.images.map((img: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="flex-1 break-all">{img}</span>
                        <button
                          type="button"
                          onClick={() =>
                            updateBlock(selectedBlock.id, {
                              images: selectedBlock.images.filter((_: any, idx: number) => idx !== i),
                            })
                          }
                          className="border px-1 rounded"
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {selectedBlock.type === 'quote' && (
                  <>
                    <input
                      type="text"
                      value={selectedBlock.text}
                      onChange={(e) => updateBlock(selectedBlock.id, { text: e.target.value })}
                      className="border p-1 rounded w-full mb-2"
                    />
                    <input
                      type="text"
                      value={selectedBlock.author || ''}
                      placeholder="Author"
                      onChange={(e) => updateBlock(selectedBlock.id, { author: e.target.value })}
                      className="border p-1 rounded w-full mb-2"
                    />
                  </>
                )}
                {selectedBlock.type === 'spacer' && (
                  <select
                    value={selectedBlock.size}
                    onChange={(e) => updateBlock(selectedBlock.id, { size: e.target.value })}
                    className="border p-1 rounded w-full"
                  >
                    <option value="sm">Small</option>
                    <option value="md">Medium</option>
                    <option value="lg">Large</option>
                  </select>
                )}
              </div>
            )}

            {/* Preview */}
            <div className="border p-2 rounded">
              <div className="mb-2 flex gap-2">
                {['mobile', 'tablet', 'desktop'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDevice(m as any)}
                    className={`px-2 py-1 border rounded text-sm ${device === m ? 'bg-neutral-200' : ''}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div
                style={{ width: widthMap[device], maxWidth: '100%', margin: '0 auto', border: '1px solid #eee', borderRadius: 12, overflow: 'hidden' }}
              >
                <SlideRenderer
                  slide={{
                    ...initial,
                    type,
                    title,
                    subtitle,
                    cta_label: ctaLabel,
                    cta_href: ctaHref,
                    media_url:
                      config.background?.kind && config.background.kind !== 'color'
                        ? config.background.value || null
                        : null,
                    config_json: config,
                  }}
                  restaurantId={restaurantId}
                  router={{ push: () => {} }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={handleSave}>{isEdit ? 'Save' : 'Create'}</Button>
        </div>
      </div>
    </div>
  );
}
