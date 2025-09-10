import React, { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
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
import { SlideRow } from '@/components/customer/home/SlidesContainer';
import SlidesSection from '@/components/SlidesSection';
import { STORAGE_BUCKET } from '@/lib/storage';
import Skeleton from '@/components/ui/Skeleton';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

// slide config types
export type SlideConfig = {
  mode?: 'structured' | 'freeform';
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
    | {
        id: string;
        type: 'heading';
        text: string;
        align?: 'left' | 'center' | 'right';
        fontSize?: number;
        fontFamily?: string;
        color?: string;
        overlay?: { color: string; opacity: number };
        rotateDeg?: number;
      }
    | {
        id: string;
        type: 'subheading';
        text: string;
        align?: 'left' | 'center' | 'right';
        fontSize?: number;
        fontFamily?: string;
        color?: string;
        overlay?: { color: string; opacity: number };
        rotateDeg?: number;
      }
    | { id: string; type: 'button'; text: string; href: string }
    | {
        id: string;
        type: 'image';
        url: string;
        width?: number;
        height?: number;
        overlay?: { color: string; opacity: number };
        rotateDeg?: number;
      }
    | { id: string; type: 'quote'; text: string; author?: string }
    | { id: string; type: 'gallery'; images: string[] }
    | { id: string; type: 'spacer'; size?: 'sm' | 'md' | 'lg' }
  )[];
  layout?: 'split';
  positions?: Record<string, { xPct: number; yPct: number; wPct?: number; hPct?: number; z?: number; rotateDeg?: number }>;
  structuredGroupAlign?: { v: 'top' | 'center' | 'bottom'; h: 'left' | 'center' | 'right' };
};

export function coerceConfig(raw: any): SlideConfig {
  const cfg = raw && typeof raw === 'object' ? raw : {};
  if (!cfg.mode) cfg.mode = 'structured';
  if (!cfg.background)
    cfg.background = { kind: 'color', value: '#111', overlay: false };
  if (!Array.isArray(cfg.blocks)) cfg.blocks = [];
  if (!cfg.positions) cfg.positions = {};
  if (!cfg.structuredGroupAlign)
    cfg.structuredGroupAlign = { v: 'center', h: 'center' };
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
  slide,
  cfg,
  setCfg,
  onClose,
  onSave,
}: {
  slide: SlideRow;
  cfg: SlideConfig;
  setCfg: React.Dispatch<React.SetStateAction<SlideConfig>>;
  onClose: () => void;
  onSave: () => void;
}) {
  const [type, setType] = useState<string>('menu_highlight');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaHref, setCtaHref] = useState('');
  const [visibleFrom, setVisibleFrom] = useState('');
  const [visibleUntil, setVisibleUntil] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  const [editInPreview, setEditInPreview] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [linkChoice, setLinkChoice] = useState('custom');
  const [customPages, setCustomPages] = useState<string[]>([]);
  const [template, setTemplate] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const imageRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const deviceFrameRef = useRef<HTMLDivElement>(null);
  const isEdit = !!slide?.id;
  const restaurantId = slide.restaurant_id;

  function select(id: string | null) {
    setSelectedId(id);
  }

  useEffect(() => {
    if (!slide) return;
    setType(slide.type);
    setTitle(slide.title || '');
    setSubtitle(slide.subtitle || '');
    setCtaLabel(slide.cta_label || '');
    setCtaHref(slide.cta_href || '');
    setVisibleFrom(slide.visible_from || '');
    setVisibleUntil(slide.visible_until || '');
    const cfg0 = coerceConfig(slide.config_json);
    if (!cfg0.blocks || cfg0.blocks.length === 0) {
      const blocks: any[] = [];
      const positions: Record<string, any> = {};
      let y = 45;
      if (slide.title) {
        const id = crypto.randomUUID();
        blocks.push({ id, type: 'heading', text: slide.title });
        positions[id] = { xPct: 50, yPct: y, rotateDeg: 0 };
        y += 10;
      }
      if (slide.subtitle) {
        const id = crypto.randomUUID();
        blocks.push({ id, type: 'subheading', text: slide.subtitle });
        positions[id] = { xPct: 50, yPct: y, rotateDeg: 0 };
        y += 10;
      }
      if (slide.cta_label) {
        const id = crypto.randomUUID();
        blocks.push({ id, type: 'button', text: slide.cta_label, href: slide.cta_href || '/menu' });
        positions[id] = { xPct: 50, yPct: y, rotateDeg: 0 };
      }
      cfg0.blocks = blocks;
      cfg0.positions = { ...(cfg0.positions || {}), ...positions };
    }
    setCfg(cfg0);
    select(null);
  }, [slide, setCfg]);

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
    setCfg((c) => {
      const next = { ...c, blocks: [...c.blocks, block] };
      if (c.mode === 'freeform') {
        next.positions = {
          ...next.positions,
          [id]: { xPct: 50, yPct: 45, rotateDeg: 0 },
        };
      }
      return next;
    });
    select(id);
  }

  function updateBlock(id: string, patch: any) {
    setCfg((c) => ({
      ...c,
      blocks: c.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }

  function deleteBlock(id: string) {
    setCfg((c) => {
      const pos = { ...c.positions };
      delete pos[id];
      return { ...c, blocks: c.blocks.filter((b) => b.id !== id), positions: pos };
    });
    if (selectedId === id) select(null);
  }

  function moveBlock(id: string, dir: 'up' | 'down') {
    setCfg((c) => {
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
    const oldIndex = cfg.blocks.findIndex((b) => b.id === active.id);
    const newIndex = cfg.blocks.findIndex((b) => b.id === over.id);
    setCfg((c) => ({ ...c, blocks: arrayMove(c.blocks, oldIndex, newIndex) }));
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
        cfg.background?.kind && cfg.background.kind !== 'color'
          ? cfg.background.value || null
          : null,
      config_json: cfg,
    };
    if (isEdit) {
      const { error } = await supabase
        .from('restaurant_slides')
        .update(payload)
        .eq('id', slide.id!)
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
    onSave();
    onClose();
  }

  const selectedBlock = cfg.blocks.find((b) => b.id === selectedId);

  const linkOptions = [...knownRoutes, ...customPages, 'custom'];
  useEffect(() => {
    if (selectedBlock && selectedBlock.type === 'button') {
      if (linkOptions.includes(selectedBlock.href)) setLinkChoice(selectedBlock.href);
      else setLinkChoice('custom');
    }
  }, [selectedBlock, linkOptions]);

  const widthMap: any = { mobile: 375, tablet: 768, desktop: 1280 };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded p-4 w-full max-w-5xl" style={{ maxHeight: '90vh', overflow: 'auto' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Blocks</span>
            <button type="button" disabled className="px-2 py-1 border rounded text-sm opacity-50">
              Undo
            </button>
            <button type="button" disabled className="px-2 py-1 border rounded text-sm opacity-50">
              Redo
            </button>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm flex items-center gap-1">
              <input
                type="checkbox"
                checked={editInPreview}
                onChange={(e) => setEditInPreview(e.target.checked)}
              />
              Edit in preview
            </label>
            <label className="text-sm flex items-center gap-1">
              <input
                type="checkbox"
                checked={showDebug}
                onChange={(e) => setShowDebug(e.target.checked)}
              />
              Show debug
            </label>
            <Button onClick={handleSave}>Save</Button>
            <button onClick={onClose} className="px-2 py-1 border rounded">
              Close
            </button>
          </div>
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
                      setCfg({
                        mode: 'structured',
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
                        positions: {},
                      });
                      break;
                    case 'quote':
                      setCfg({
                        mode: 'structured',
                        background: { kind: 'color', value: '#fff' },
                        blocks: [
                          {
                            id: crypto.randomUUID(),
                            type: 'quote',
                            text: 'Best food in town!',
                            author: 'Happy Customer',
                          },
                        ],
                        positions: {},
                      });
                      break;
                    case 'gallery':
                      setCfg({
                        mode: 'structured',
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
                        positions: {},
                      });
                      break;
                    case 'split':
                      setCfg({
                        mode: 'structured',
                        background: { kind: 'color', value: '#fff' },
                        blocks: [
                          { id: crypto.randomUUID(), type: 'image', url: '' },
                          { id: crypto.randomUUID(), type: 'heading', text: 'Your headline' },
                        ],
                        layout: 'split',
                        positions: {},
                      });
                      break;
                    case 'cta':
                      setCfg({
                        mode: 'structured',
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
                        positions: {},
                      });
                      break;
                    case 'freeform':
                      setCfg({
                        mode: 'freeform',
                        background: { kind: 'color', value: '#111', overlay: false },
                        blocks: [],
                        positions: {},
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
                <option value="freeform">Custom (Freeform)</option>
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
          <SortableContext items={cfg.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                {cfg.blocks.map((b, i) => (
                  <SortableBlock
                    key={b.id}
                    block={b}
                    onSelect={select}
                    selected={b.id === selectedId}
                    onDelete={deleteBlock}
                    onMove={moveBlock}
                    index={i}
                    lastIndex={cfg.blocks.length - 1}
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
                value={cfg.background?.kind}
                onChange={(e) =>
                  setCfg({ ...cfg, background: { ...cfg.background!, kind: e.target.value as any } })
                }
                className="border p-1 rounded w-full mb-2"
              >
                <option value="color">Color</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
              {cfg.background?.kind === 'color' && (
                <input
                  type="text"
                  value={cfg.background?.value || ''}
                  onChange={(e) =>
                    setCfg({ ...cfg, background: { ...cfg.background!, value: e.target.value } })
                  }
                  className="border p-1 rounded w-full"
                />
              )}
              {cfg.background?.kind !== 'color' && (
                <div className="space-y-1">
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadFile(f, (url) =>
                        setCfg({ ...cfg, background: { ...cfg.background!, value: url } })
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
                  {cfg.background?.value && (
                    <div className="text-xs break-all">{cfg.background.value}</div>
                  )}
                </div>
              )}
              <label className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={cfg.background?.overlay || false}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      background: { ...cfg.background!, overlay: e.target.checked },
                    })
                  }
                />
                Overlay
              </label>
              {cfg.background?.overlay && (
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    placeholder="#000"
                    value={cfg.background?.overlayColor || ''}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        background: { ...cfg.background!, overlayColor: e.target.value },
                      })
                    }
                    className="border p-1 rounded flex-1"
                  />
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="0.6"
                    value={cfg.background?.overlayOpacity ?? 0.25}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        background: {
                          ...cfg.background!,
                          overlayOpacity: parseFloat(e.target.value),
                        },
                      })
                    }
                    className="border p-1 rounded w-20"
                  />
                </div>
              )}
            </div>

            {cfg.mode === 'structured' && (
              <div className="border p-2 rounded mt-2">
                <h3 className="font-medium mb-2">Group Position</h3>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs">Vertical</label>
                  <select
                    value={cfg.structuredGroupAlign?.v || 'center'}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        structuredGroupAlign: {
                          ...(cfg.structuredGroupAlign || { h: 'center' }),
                          v: e.target.value as any,
                        },
                      })
                    }
                    className="border p-1 rounded flex-1"
                  >
                    <option value="top">Top</option>
                    <option value="center">Center</option>
                    <option value="bottom">Bottom</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs">Horizontal</label>
                  <select
                    value={cfg.structuredGroupAlign?.h || 'center'}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        structuredGroupAlign: {
                          ...(cfg.structuredGroupAlign || { v: 'center' }),
                          h: e.target.value as any,
                        },
                      })
                    }
                    className="border p-1 rounded flex-1"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </div>
            )}

            {/* Block properties */}
            {selectedBlock && (
              <div className="border p-2 rounded">
                <h3 className="font-medium mb-2">Block</h3>
                {selectedBlock.type === 'heading' || selectedBlock.type === 'subheading' ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={selectedBlock.text}
                      onChange={(e) => updateBlock(selectedBlock.id, { text: e.target.value })}
                      className="border p-1 rounded w-full"
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-xs">Size</label>
                      <input
                        type="number"
                        value={selectedBlock.fontSize || ''}
                        onChange={(e) => updateBlock(selectedBlock.id, { fontSize: parseInt(e.target.value) || undefined })}
                        className="border p-1 rounded w-20"
                      />
                      <label className="text-xs">Font</label>
                      <select
                        value={selectedBlock.fontFamily || ''}
                        onChange={(e) => updateBlock(selectedBlock.id, { fontFamily: e.target.value || undefined })}
                        className="border p-1 rounded"
                      >
                        <option value="">Default</option>
                        <option value="serif">Serif</option>
                        <option value="monospace">Mono</option>
                      </select>
                      <label className="text-xs">Color</label>
                      <input
                        type="color"
                        value={selectedBlock.color || '#000000'}
                        onChange={(e) => updateBlock(selectedBlock.id, { color: e.target.value })}
                        className="border rounded w-10 h-6 p-0"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs">Rotate</label>
                      <input
                        type="number"
                        min="-45"
                        max="45"
                        value={selectedBlock.rotateDeg || 0}
                        onChange={(e) => updateBlock(selectedBlock.id, { rotateDeg: parseInt(e.target.value) || 0 })}
                        className="border p-1 rounded w-20"
                      />
                      <label className="text-xs">Overlay</label>
                      <input
                        type="checkbox"
                        checked={!!selectedBlock.overlay}
                        onChange={(e) =>
                          updateBlock(selectedBlock.id, {
                            overlay: e.target.checked
                              ? { color: '#000000', opacity: 0.25 }
                              : undefined,
                          })
                        }
                      />
                      {selectedBlock.overlay && (
                        <>
                          <input
                            type="color"
                            value={selectedBlock.overlay.color}
                            onChange={(e) =>
                              updateBlock(selectedBlock.id, {
                                overlay: {
                                  ...selectedBlock.overlay!,
                                  color: e.target.value,
                                },
                              })
                            }
                            className="border rounded w-10 h-6 p-0"
                          />
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="0.6"
                            value={selectedBlock.overlay.opacity}
                            onChange={(e) =>
                              updateBlock(selectedBlock.id, {
                                overlay: {
                                  ...selectedBlock.overlay!,
                                  opacity: parseFloat(e.target.value),
                                },
                              })
                            }
                            className="border p-1 rounded w-20"
                          />
                        </>
                      )}
                    </div>
                  </div>
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
                    <div className="flex items-center gap-2">
                      <label className="text-xs">Rotate</label>
                      <input
                        type="number"
                        min="-45"
                        max="45"
                        value={selectedBlock.rotateDeg || 0}
                        onChange={(e) =>
                          updateBlock(selectedBlock.id, { rotateDeg: parseInt(e.target.value) || 0 })
                        }
                        className="border p-1 rounded w-20"
                      />
                      <label className="text-xs">Overlay</label>
                      <input
                        type="checkbox"
                        checked={!!selectedBlock.overlay}
                        onChange={(e) =>
                          updateBlock(selectedBlock.id, {
                            overlay: e.target.checked
                              ? { color: '#000000', opacity: 0.25 }
                              : undefined,
                          })
                        }
                      />
                      {selectedBlock.overlay && (
                        <>
                          <input
                            type="color"
                            value={selectedBlock.overlay.color}
                            onChange={(e) =>
                              updateBlock(selectedBlock.id, {
                                overlay: {
                                  ...selectedBlock.overlay!,
                                  color: e.target.value,
                                },
                              })
                            }
                            className="border rounded w-10 h-6 p-0"
                          />
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="0.6"
                            value={selectedBlock.overlay.opacity}
                            onChange={(e) =>
                              updateBlock(selectedBlock.id, {
                                overlay: {
                                  ...selectedBlock.overlay!,
                                  opacity: parseFloat(e.target.value),
                                },
                              })
                            }
                            className="border p-1 rounded w-20"
                          />
                        </>
                      )}
                    </div>
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
                ref={deviceFrameRef}
                style={{
                  position: 'relative',
                  width: widthMap[device],
                  maxWidth: '100%',
                  margin: '0 auto',
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: '#fff',
                }}
              >
                <SlidesSection
                  slide={{ ...slide, type, title, subtitle, cta_label: ctaLabel, cta_href: ctaHref, media_url: cfg.background?.kind && cfg.background.kind !== 'color' ? cfg.background.value || null : null, config_json: cfg }}
                  cfg={cfg}
                  setCfg={setCfg}
                  editingEnabled={editInPreview}
                  showEditorDebug={showDebug}
                  deviceFrameRef={deviceFrameRef}
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
