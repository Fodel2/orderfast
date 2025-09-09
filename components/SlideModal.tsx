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
import { SlideRenderer, SlideRow } from '@/components/customer/home/SlidesContainer';
import { STORAGE_BUCKET } from '@/lib/storage';
import Skeleton from '@/components/ui/Skeleton';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

// ---------- InteractiveBox helper ----------
type InteractiveBoxProps = {
  id: string;
  selected: boolean;
  deviceFrameRef: React.RefObject<HTMLDivElement>;
  pos: { xPct: number; yPct: number; wPct?: number; hPct?: number; z?: number; rotateDeg?: number };
  onChange: (next: { xPct: number; yPct: number; wPct?: number; hPct?: number; z?: number; rotateDeg?: number }) => void;
  children: React.ReactNode;
};

function InteractiveBox({ selected, deviceFrameRef, pos, onChange, children }: InteractiveBoxProps) {
  const startRef = React.useRef<{
    type: 'move' | 'resize' | 'rotate';
    x: number;
    y: number;
    rect: DOMRect;
    pos: any;
    corner?: string;
  } | null>(null);
  const getFrame = () => deviceFrameRef.current!;
  const clampPct = (v: number) => Math.min(100, Math.max(0, v));
  const pct = (px: number, total: number) => clampPct((px / total) * 100);

  const onPointerDownMove = (e: React.PointerEvent) => {
    e.preventDefault();
    const rect = getFrame().getBoundingClientRect();
    startRef.current = { type: 'move', x: e.clientX, y: e.clientY, rect, pos: { ...pos } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerDownResize = (corner: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    const rect = getFrame().getBoundingClientRect();
    startRef.current = { type: 'resize', corner, x: e.clientX, y: e.clientY, rect, pos: { ...pos } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerDownRotate = (e: React.PointerEvent) => {
    e.preventDefault();
    const rect = getFrame().getBoundingClientRect();
    startRef.current = { type: 'rotate', x: e.clientX, y: e.clientY, rect, pos: { ...pos } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = startRef.current;
    if (!s) return;
    const rect = s.rect;
    if (s.type === 'move') {
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      const newX = (s.pos.xPct / 100) * rect.width + dx;
      const newY = (s.pos.yPct / 100) * rect.height + dy;
      onChange({ ...s.pos, xPct: pct(newX, rect.width), yPct: pct(newY, rect.height) });
    } else if (s.type === 'resize') {
      const baseW = ((s.pos.wPct ?? 40) / 100) * rect.width;
      const baseH = ((s.pos.hPct ?? 20) / 100) * rect.height;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      let w = baseW,
        h = baseH;
      if (s.corner?.includes('e')) w = baseW + dx;
      if (s.corner?.includes('w')) w = baseW - dx;
      if (s.corner?.includes('s')) h = baseH + dy;
      if (s.corner?.includes('n')) h = baseH - dy;
      onChange({ ...s.pos, wPct: pct(Math.max(40, w), rect.width), hPct: pct(Math.max(20, h), rect.height) });
    } else if (s.type === 'rotate') {
      const cx = rect.left + (s.pos.xPct / 100) * rect.width;
      const cy = rect.top + (s.pos.yPct / 100) * rect.height;
      const ang = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
      onChange({ ...s.pos, rotateDeg: Math.round(ang) });
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    startRef.current = null;
  };

  const boxStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${pos.xPct}%`,
    top: `${pos.yPct}%`,
    transform: `translate(-50%, -50%) rotate(${pos.rotateDeg ?? 0}deg)`,
    width: pos.wPct ? `${pos.wPct}%` : 'auto',
    height: pos.hPct ? `${pos.hPct}%` : 'auto',
    zIndex: pos.z ?? 1,
    touchAction: 'none',
  };
  const handle: React.CSSProperties = {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 9999,
    background: '#fff',
    border: '1px solid #111',
  };

  return (
    <div
      style={boxStyle}
      onPointerDown={onPointerDownMove}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {children}
      {selected && (
        <>
          <div
            onPointerDown={onPointerDownRotate}
            style={{
              position: 'absolute',
              left: '50%',
              top: -24,
              transform: 'translateX(-50%)',
              width: 14,
              height: 14,
              borderRadius: 9999,
              background: '#fff',
              border: '1px solid #111',
            }}
          />
          {[
            ['nw', { left: -5, top: -5 }],
            ['n', { left: '50%', top: -5, transform: 'translateX(-50%)' }],
            ['ne', { right: -5, top: -5 }],
            ['e', { right: -5, top: '50%', transform: 'translateY(-50%)' }],
            ['se', { right: -5, bottom: -5 }],
            ['s', { left: '50%', bottom: -5, transform: 'translateX(-50%)' }],
            ['sw', { left: -5, bottom: -5 }],
            ['w', { left: -5, top: '50%', transform: 'translateY(-50%)' }],
          ].map(([corner, style]) => (
            <div
              key={corner as string}
              onPointerDown={onPointerDownResize(corner as string)}
              style={{ ...handle, ...(style as CSSProperties) }}
            />
          ))}
        </>
      )}
    </div>
  );
}
// ---------- end InteractiveBox ----------

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
  const deviceFrameRef = useRef<HTMLDivElement>(null);
  const isEdit = !!initial?.id;
  const restaurantId = initial.restaurant_id;

  function select(id: string | null) {
    console.log('Select', id);
    setSelectedId(id);
  }

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
    console.log('SlideEditor mount', { mode: cfg.mode, blocks: cfg.blocks.length });
    setConfig(cfg);
    select(null);
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
    setConfig((c) => {
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
    setConfig((c) => ({
      ...c,
      blocks: c.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }

  function deleteBlock(id: string) {
    setConfig((c) => {
      const pos = { ...c.positions };
      delete pos[id];
      return { ...c, blocks: c.blocks.filter((b) => b.id !== id), positions: pos };
    });
    if (selectedId === id) select(null);
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
                      setConfig({
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
                      setConfig({
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
                      setConfig({
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
                      setConfig({
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
                      setConfig({
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
              <SortableContext items={config.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                {config.blocks.map((b, i) => (
                  <SortableBlock
                    key={b.id}
                    block={b}
                    onSelect={select}
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

            {config.mode === 'structured' && (
              <div className="border p-2 rounded mt-2">
                <h3 className="font-medium mb-2">Group Position</h3>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs">Vertical</label>
                  <select
                    value={config.structuredGroupAlign?.v || 'center'}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        structuredGroupAlign: {
                          ...(config.structuredGroupAlign || { h: 'center' }),
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
                    value={config.structuredGroupAlign?.h || 'center'}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        structuredGroupAlign: {
                          ...(config.structuredGroupAlign || { v: 'center' }),
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
                style={{ position: 'relative', width: widthMap[device], maxWidth: '100%', margin: '0 auto', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}
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
                  editable={true}
                  selectedId={selectedId}
                  onTextChange={(id, text) => updateBlock(id, { text })}
                  blockWrapper={
                    config.mode === 'freeform'
                      ? (b, content, pos) => (
                          <InteractiveBox
                            key={b.id}
                            id={b.id}
                            selected={selectedId === b.id}
                            deviceFrameRef={deviceFrameRef}
                            pos={pos}
                            onChange={(next) => {
                              console.log('Move/Resize/Rotate', b.id, next);
                              setConfig((c) => ({
                                ...c,
                                positions: { ...c.positions, [b.id]: next },
                              }));
                            }}
                          >
                            <div onClick={() => select(b.id)}>{content}</div>
                          </InteractiveBox>
                        )
                      : undefined
                  }
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
