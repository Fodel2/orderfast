import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowsUpDownIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { toast } from '@/components/ui/toast';
import { supabase } from '@/utils/supabaseClient';
import type { SlideRow } from '@/components/customer/home/SlidesContainer';

export type DeviceKind = 'mobile' | 'tablet' | 'desktop';

export const DEVICE_DIMENSIONS: Record<DeviceKind, { width: number; height: number }> = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
  desktop: { width: 1280, height: 800 },
};

export type Frame = {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
};

export type SlideBlock = {
  id: string;
  kind: 'heading' | 'subheading' | 'text' | 'button' | 'image' | 'quote' | 'gallery' | 'spacer';
  text?: string;
  href?: string;
  src?: string;
  items?: { src: string; alt?: string }[];
  frames: Partial<Record<DeviceKind, Frame>>;
  color?: string;
  align?: 'left' | 'center' | 'right';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  buttonVariant?: 'primary' | 'secondary';
  fit?: 'cover' | 'contain';
  author?: string;
  height?: number;
  locked?: boolean;
};

export type SlideBackground = {
  type: 'none' | 'color' | 'image' | 'video';
  color?: string;
  opacity?: number;
  url?: string;
  fit?: 'cover' | 'contain';
  focal?: { x: number; y: number };
  overlay?: { color: string; opacity: number };
  blur?: number;
  poster?: string;
  loop?: boolean;
  mute?: boolean;
  autoplay?: boolean;
};

export type SlideCfg = {
  background?: SlideBackground;
  blocks: SlideBlock[];
};

export type SlidesManagerChangeOptions = {
  commit?: boolean;
};

type SlidesManagerProps = {
  initialCfg: SlideCfg;
  onChange: (cfg: SlideCfg, options?: SlidesManagerChangeOptions) => void;
  editable: boolean;
  selectedId?: string | null;
  onSelectBlock?: (id: string | null) => void;
  openInspector?: () => void;
  onCanvasClick?: () => void;
  activeDevice?: DeviceKind;
  editInPreview?: boolean;
  scale?: number;
  onManipulationChange?: (manipulating: boolean) => void;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function ensureFrame(block: SlideBlock, device: DeviceKind): Frame {
  const fallback: Frame = { x: 10, y: 10, w: 40, h: 20, r: 0 };
  if (block.frames?.[device]) return block.frames[device]!;
  const existing = Object.values(block.frames || {})[0];
  return existing ? existing : fallback;
}

export default function SlidesManager({
  initialCfg,
  onChange,
  editable,
  selectedId,
  onSelectBlock,
  openInspector,
  onCanvasClick,
  activeDevice = 'desktop',
  editInPreview = true,
  scale = 1,
  onManipulationChange,
}: SlidesManagerProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const cfg = useMemo(() => initialCfg, [initialCfg]);
  const deviceSize = DEVICE_DIMENSIONS[activeDevice] ?? DEVICE_DIMENSIONS.desktop;

  const handleFrameChange = (blockId: string, frame: Frame, options?: SlidesManagerChangeOptions) => {
    const next: SlideCfg = {
      ...cfg,
      blocks: cfg.blocks.map((b) =>
        b.id === blockId
          ? {
              ...b,
              frames: {
                ...b.frames,
                [activeDevice]: { ...frame },
              },
            }
          : b
      ),
    };
    onChange(next, options);
  };

  const handleInlineText = (blockId: string, text: string) => {
    const next: SlideCfg = {
      ...cfg,
      blocks: cfg.blocks.map((b) => (b.id === blockId ? { ...b, text } : b)),
    };
    onChange(next, { commit: true });
  };

  const renderBlockContent = (block: SlideBlock): ReactNode => {
    switch (block.kind) {
      case 'heading':
      case 'subheading':
      case 'text': {
        const Tag = block.kind === 'heading' ? 'h2' : block.kind === 'subheading' ? 'h3' : 'p';
        const sizes: Record<NonNullable<SlideBlock['size']>, string> = {
          sm: '1.125rem',
          md: '1.5rem',
          lg: '2.5rem',
          xl: '3.5rem',
        };
        const style: CSSProperties = {
          color: block.color || '#ffffff',
          textAlign: block.align ?? 'left',
          fontSize: block.size ? sizes[block.size] ?? undefined : undefined,
          fontWeight: block.kind === 'heading' ? 700 : block.kind === 'subheading' ? 600 : 400,
        };
        const editableProps =
          editable && editInPreview
            ? {
                contentEditable: true,
                suppressContentEditableWarning: true,
                onBlur: (e: React.FocusEvent<HTMLElement>) =>
                  handleInlineText(block.id, e.currentTarget.textContent || ''),
              }
            : {};
        return (
          <Tag
            {...editableProps}
            style={style}
            className="leading-tight"
          >
            {block.text ?? ''}
          </Tag>
        );
      }
      case 'button': {
        return (
          <a
            href={block.href || '#'}
            onClick={(e) => e.preventDefault()}
            className={`btn-primary inline-flex items-center justify-center px-5 py-3 ${
              block.buttonVariant === 'secondary' ? 'bg-white text-black' : ''
            }`}
            style={{ textAlign: 'center' }}
          >
            {block.text || 'Button'}
          </a>
        );
      }
      case 'image': {
        if (!block.src) return <div className="bg-neutral-200 w-full h-full rounded" />;
        return (
          <img
            src={block.src}
            alt=""
            className="w-full h-full object-cover"
            style={{ objectFit: block.fit || 'cover', borderRadius: 12 }}
          />
        );
      }
      case 'quote': {
        return (
          <div className="text-white">
            <p className="italic">“{block.text ?? ''}”</p>
            {block.author && <p className="mt-2 text-sm">— {block.author}</p>}
          </div>
        );
      }
      case 'gallery': {
        return (
          <div className="flex h-full w-full gap-2 overflow-hidden rounded">
            {(block.items || []).map((item) => (
              <img
                key={item.src}
                src={item.src}
                alt={item.alt || ''}
                className="h-full flex-1 object-cover"
              />
            ))}
          </div>
        );
      }
      case 'spacer':
        return <div className="w-full h-full" />;
      default:
        return null;
    }
  };

  const clampedScale = Math.min(Math.max(scale || 1, 0.05), 1);

  return (
    <div className="flex h-full w-full items-start justify-center overflow-hidden">
      <div
        className="relative"
        style={{
          width: deviceSize.width,
          height: deviceSize.height,
          transform: `scale(${clampedScale})`,
          transformOrigin: 'top center',
          margin: '0 auto',
        }}
      >
        <div
          ref={frameRef}
          className="relative overflow-hidden rounded-2xl bg-white shadow-xl"
          style={{ width: deviceSize.width, height: deviceSize.height }}
          onClick={() => {
            if (editable && editInPreview) {
              onSelectBlock?.(null);
              onCanvasClick?.();
            }
          }}
        >
          <SlideBackground cfg={cfg} />
          <div
            className="absolute inset-0"
            style={{ pointerEvents: editable && editInPreview ? 'auto' : 'none' }}
          >
            {cfg.blocks.map((block) => {
              const frame = ensureFrame(block, activeDevice);
              const locked = Boolean(block.locked);
              return (
                <InteractiveBox
                  key={block.id}
                  id={block.id}
                  frame={frame}
                  containerRef={frameRef}
                  selected={selectedId === block.id}
                  editable={editable && editInPreview}
                  onSelect={() => onSelectBlock?.(block.id)}
                  onTap={() => {
                    onSelectBlock?.(block.id);
                    openInspector?.();
                  }}
                  onChange={(nextFrame, opts) => handleFrameChange(block.id, nextFrame, opts)}
                  scale={clampedScale}
                  locked={locked}
                  onManipulationChange={onManipulationChange}
                >
                  {renderBlockContent(block)}
                </InteractiveBox>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

type InteractiveBoxProps = {
  id: string;
  frame: Frame;
  containerRef: React.RefObject<HTMLDivElement>;
  selected: boolean;
  editable: boolean;
  onSelect: () => void;
  onTap: () => void;
  onChange: (frame: Frame, options?: SlidesManagerChangeOptions) => void;
  children: ReactNode;
  scale: number;
  locked?: boolean;
  onManipulationChange?: (manipulating: boolean) => void;
};

type PointerState = {
  type: 'move' | 'resize' | 'rotate';
  startX: number;
  startY: number;
  startTime: number;
  startFrame: Frame;
  corner?: string;
  scale: number;
  moved: boolean;
  hasManipulated: boolean;
  locked: boolean;
};

const TAP_MAX_MOVEMENT = 4;
const TAP_MAX_DURATION = 300;

function InteractiveBox({
  frame,
  containerRef,
  selected,
  editable,
  onSelect,
  onTap,
  onChange,
  children,
  scale,
  locked = false,
  onManipulationChange,
}: InteractiveBoxProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const pointerState = useRef<PointerState | null>(null);

  const getContainerRect = () => containerRef.current?.getBoundingClientRect();

  const handlePointerDown = (type: PointerState['type'], corner?: string) => (e: React.PointerEvent) => {
    if (!editable) return;
    e.stopPropagation();
    const rect = getContainerRect();
    if (!rect) return;
    if (locked && type !== 'move') {
      onSelect();
      return;
    }
    const state: PointerState = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      startTime: performance.now(),
      startFrame: { ...frame },
      corner,
      scale,
      moved: false,
      hasManipulated: false,
      locked,
    };
    if (type === 'rotate' && !locked) {
      state.hasManipulated = true;
      onManipulationChange?.(true);
    }
    pointerState.current = state;
    localRef.current?.setPointerCapture?.(e.pointerId);
    onSelect();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!editable) return;
    const ps = pointerState.current;
    if (!ps) return;
    const rect = getContainerRect();
    if (!rect) return;
    const deltaX = e.clientX - ps.startX;
    const deltaY = e.clientY - ps.startY;
    const distance = Math.max(Math.abs(deltaX), Math.abs(deltaY));
    if (distance > TAP_MAX_MOVEMENT) {
      ps.moved = true;
    }
    if (ps.locked) return;
    const effectiveScale = ps.scale || 1;
    const width = rect.width / effectiveScale;
    const height = rect.height / effectiveScale;
    const scaledX = deltaX / effectiveScale;
    const scaledY = deltaY / effectiveScale;
    const dx = (scaledX / width) * 100;
    const dy = (scaledY / height) * 100;

    if ((ps.type === 'move' || ps.type === 'resize') && !ps.hasManipulated && distance > TAP_MAX_MOVEMENT) {
      ps.hasManipulated = true;
      onManipulationChange?.(true);
    }

    if (ps.type === 'move') {
      const next: Frame = {
        ...ps.startFrame,
        x: clamp(ps.startFrame.x + dx, 0, 100 - ps.startFrame.w),
        y: clamp(ps.startFrame.y + dy, 0, 100 - ps.startFrame.h),
      };
      onChange(next, { commit: false });
    } else if (ps.type === 'resize') {
      const next: Frame = { ...ps.startFrame };
      const min = 5;
      if (ps.corner?.includes('e')) {
        next.w = clamp(ps.startFrame.w + dx, min, 100 - ps.startFrame.x);
      }
      if (ps.corner?.includes('s')) {
        next.h = clamp(ps.startFrame.h + dy, min, 100 - ps.startFrame.y);
      }
      if (ps.corner?.includes('w')) {
        const newX = clamp(ps.startFrame.x + dx, 0, ps.startFrame.x + ps.startFrame.w - min);
        const delta = ps.startFrame.x - newX;
        next.x = newX;
        next.w = clamp(ps.startFrame.w + delta, min, 100 - newX);
      }
      if (ps.corner?.includes('n')) {
        const newY = clamp(ps.startFrame.y + dy, 0, ps.startFrame.y + ps.startFrame.h - min);
        const delta = ps.startFrame.y - newY;
        next.y = newY;
        next.h = clamp(ps.startFrame.h + delta, min, 100 - newY);
      }
      onChange(next, { commit: false });
    } else if (ps.type === 'rotate') {
      const el = localRef.current;
      if (!el) return;
      if (!ps.hasManipulated) {
        ps.hasManipulated = true;
        onManipulationChange?.(true);
      }
      const box = el.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const angle = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
      const deg = ((Math.round(angle) % 360) + 360) % 360;
      onChange({ ...ps.startFrame, r: deg }, { commit: false });
    }
  };

  const handlePointerEnd = (e: React.PointerEvent) => {
    if (!editable) return;
    const ps = pointerState.current;
    if (!ps) return;
    pointerState.current = null;
    localRef.current?.releasePointerCapture?.(e.pointerId);
    const duration = performance.now() - ps.startTime;
    const deltaX = e.clientX - ps.startX;
    const deltaY = e.clientY - ps.startY;
    const distance = Math.max(Math.abs(deltaX), Math.abs(deltaY));
    const isTap =
      ps.type === 'move' &&
      !ps.hasManipulated &&
      distance < TAP_MAX_MOVEMENT &&
      duration < TAP_MAX_DURATION;

    if (ps.hasManipulated && !ps.locked) {
      onChange(frame, { commit: true });
    } else if (isTap) {
      onTap();
    }

    if (ps.hasManipulated) {
      onManipulationChange?.(false);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (!editable) return;
    const ps = pointerState.current;
    if (!ps) return;
    pointerState.current = null;
    localRef.current?.releasePointerCapture?.(e.pointerId);
    if (ps.hasManipulated) {
      onManipulationChange?.(false);
    }
  };

  const style: CSSProperties = {
    position: 'absolute',
    left: `${frame.x}%`,
    top: `${frame.y}%`,
    width: `${frame.w}%`,
    height: `${frame.h}%`,
    transform: `rotate(${frame.r ?? 0}deg)`,
    transformOrigin: 'top left',
    border: selected && editable ? '1px dashed rgba(56,189,248,0.8)' : undefined,
    borderRadius: 8,
    touchAction: 'none',
    cursor: editable && !locked ? 'move' : 'default',
  };

  return (
    <div
      ref={localRef}
      style={style}
      onPointerDown={handlePointerDown('move')}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerCancel}
      onClick={(e) => {
        if (!editable) return;
        e.stopPropagation();
        onSelect();
      }}
    >
      {children}
      {editable && selected && (
        <>
          <div
            onPointerDown={handlePointerDown('rotate')}
            className="absolute left-1/2 top-[-32px] h-5 w-5 -translate-x-1/2 rounded-full border border-sky-500 bg-white"
          />
          {[
            ['n', '50%', 0],
            ['s', '50%', 100],
            ['w', 0, '50%'],
            ['e', 100, '50%'],
            ['nw', 0, 0],
            ['ne', 100, 0],
            ['sw', 0, 100],
            ['se', 100, 100],
          ].map(([corner, left, top]) => (
            <div
              key={corner as string}
              onPointerDown={handlePointerDown('resize', corner as string)}
              className="absolute h-3 w-3 rounded-full border border-sky-500 bg-white"
              style={{
                left: typeof left === 'number' ? `${left}%` : left,
                top: typeof top === 'number' ? `${top}%` : top,
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

function SlideBackground({ cfg }: { cfg: SlideCfg }) {
  const bg = cfg.background;
  if (!bg || bg.type === 'none') return null;
  if (bg.type === 'color') {
    const opacity = typeof bg.opacity === 'number' ? clamp(bg.opacity, 0, 1) : 1;
    return (
      <>
        <div
          className="absolute inset-0"
          style={{ background: bg.color || '#111', opacity, pointerEvents: 'none' }}
        />
        {bg.overlay && (
          <div
            className="absolute inset-0"
            style={{
              background: bg.overlay.color,
              opacity: bg.overlay.opacity,
              pointerEvents: 'none',
            }}
          />
        )}
      </>
    );
  }
  if (bg.type === 'image') {
    const focalX = clamp(bg.focal?.x ?? 0.5, 0, 1);
    const focalY = clamp(bg.focal?.y ?? 0.5, 0, 1);
    const blur = typeof bg.blur === 'number' ? clamp(bg.blur, 0, 12) : 0;
    return (
      <>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: bg.url ? `url(${bg.url})` : undefined,
            backgroundSize: bg.fit || 'cover',
            backgroundPosition: `${(focalX * 100).toFixed(2)}% ${(focalY * 100).toFixed(2)}%`,
            filter: blur ? `blur(${blur}px)` : undefined,
            pointerEvents: 'none',
          }}
        />
        {bg.overlay && (
          <div
            className="absolute inset-0"
            style={{
              background: bg.overlay.color,
              opacity: bg.overlay.opacity,
              pointerEvents: 'none',
            }}
          />
        )}
      </>
    );
  }
  if (bg.type === 'video' && bg.url) {
    const focalX = clamp(bg.focal?.x ?? 0.5, 0, 1);
    const focalY = clamp(bg.focal?.y ?? 0.5, 0, 1);
    const blur = typeof bg.blur === 'number' ? clamp(bg.blur, 0, 12) : 0;
    return (
      <>
        <video
          src={bg.url}
          poster={bg.poster}
          loop={bg.loop ?? true}
          muted={bg.mute ?? true}
          autoPlay={bg.autoplay ?? true}
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            objectFit: bg.fit || 'cover',
            objectPosition: `${(focalX * 100).toFixed(2)}% ${(focalY * 100).toFixed(2)}%`,
            filter: blur ? `blur(${blur}px)` : undefined,
          }}
        />
        {bg.overlay && (
          <div
            className="absolute inset-0"
            style={{
              background: bg.overlay.color,
              opacity: bg.overlay.opacity,
              pointerEvents: 'none',
            }}
          />
        )}
      </>
    );
  }
  return null;
}

export function SlidesDashboardList({
  restaurantId,
  onEdit,
  refreshKey,
}: {
  restaurantId: string;
  onEdit: (row: SlideRow) => void;
  refreshKey: number;
}) {
  const [slides, setSlides] = useState<SlideRow[]>([]);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  async function loadSlides() {
    setLoading(true);
    const { data, error } = await supabase
      .from('restaurant_slides')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('sort_order', { ascending: true });
    if (error) {
      toast.error('Failed to load slides');
    } else {
      setSlides(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (restaurantId) loadSlides();
  }, [restaurantId, refreshKey]);

  function openCreate() {
    onEdit({ restaurant_id: restaurantId, type: 'menu_highlight' });
  }

  function openEdit(row: SlideRow) {
    onEdit(row);
  }

  async function handleDelete(row: SlideRow) {
    if (!confirm('Delete this slide?')) return;
    const prev = slides;
    setSlides(prev.filter((s) => s.id !== row.id));
    const { error } = await supabase
      .from('restaurant_slides')
      .delete()
      .eq('id', row.id)
      .eq('restaurant_id', restaurantId);
    if (error) {
      toast.error('Failed to delete');
      setSlides(prev);
    }
  }

  async function toggleActive(row: SlideRow) {
    const updated = slides.map((s) => (s.id === row.id ? { ...s, is_active: !row.is_active } : s));
    setSlides(updated);
    const { error } = await supabase
      .from('restaurant_slides')
      .update({ is_active: !row.is_active })
      .eq('id', row.id)
      .eq('restaurant_id', restaurantId);
    if (error) {
      toast.error('Failed to update');
      setSlides(slides);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const nonHero = slides.filter((s) => s.type !== 'hero');
    const oldIndex = nonHero.findIndex((s) => s.id === active.id);
    const newIndex = nonHero.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(nonHero, oldIndex, newIndex);
    setSlides((prev) => {
      const heroes = prev.filter((s) => s.type === 'hero');
      return [...heroes, ...reordered].sort((a, b) => a.sort_order - b.sort_order);
    });
    const responses = await Promise.all(
      reordered.map((s, i) =>
        supabase
          .from('restaurant_slides')
          .update({ sort_order: i })
          .eq('id', s.id!)
          .eq('restaurant_id', restaurantId)
      )
    );
    if (responses.some((r) => r.error)) {
      toast.error('Failed to reorder');
      loadSlides();
    } else {
      loadSlides();
    }
  }

  async function move(row: SlideRow, dir: 'up' | 'down') {
    const nonHero = slides
      .filter((s) => s.type !== 'hero')
      .sort((a, b) => a.sort_order - b.sort_order);
    const index = nonHero.findIndex((s) => s.id === row.id);
    const swapIndex = dir === 'up' ? index - 1 : index + 1;
    if (index === -1 || swapIndex < 0 || swapIndex >= nonHero.length) return;
    const target = nonHero[swapIndex];
    const reordered = [...nonHero];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    setSlides((prev) => {
      const heroes = prev.filter((s) => s.type === 'hero');
      return [...heroes, ...reordered].sort((a, b) => a.sort_order - b.sort_order);
    });
    const [resA, resB] = await Promise.all([
      supabase
        .from('restaurant_slides')
        .update({ sort_order: swapIndex })
        .eq('id', row.id!)
        .eq('restaurant_id', restaurantId),
      supabase
        .from('restaurant_slides')
        .update({ sort_order: index })
        .eq('id', target.id!)
        .eq('restaurant_id', restaurantId),
    ]);
    if (resA.error || resB.error) {
      toast.error('Failed to reorder');
      loadSlides();
    } else {
      loadSlides();
    }
  }

  async function addStarter() {
    const { data: maxRow, error: maxErr } = await supabase
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
    const base = (maxRow?.sort_order ?? -1) + 1;
    const rows: SlideRow[] = [
      {
        restaurant_id: restaurantId,
        type: 'menu_highlight',
        title: 'Customer Favourites',
        subtitle: 'What locals love most',
        cta_label: 'Browse Menu',
        cta_href: '/menu',
        sort_order: base,
        is_active: true,
      },
      {
        restaurant_id: restaurantId,
        type: 'reviews',
        title: 'Loved by the community',
        subtitle: '4.8 ★ average',
        sort_order: base + 1,
        is_active: true,
      },
      {
        restaurant_id: restaurantId,
        type: 'location_hours',
        title: 'Find Us',
        subtitle: 'Open today',
        cta_label: 'Get Directions',
        cta_href: '/p/contact',
        sort_order: base + 2,
        is_active: true,
      },
    ];
    const { error } = await supabase.from('restaurant_slides').insert(rows);
    if (error) {
      toast.error('Failed to insert');
    } else {
      toast.success('Starter slides added');
      loadSlides();
    }
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Slides (beta)</h3>
        <div className="flex gap-2">
          <button onClick={addStarter} className="px-3 py-2 rounded border">
            Add Starter Slides
          </button>
          <button onClick={openCreate} className="px-3 py-2 rounded bg-emerald-600 text-white">
            New Slide
          </button>
        </div>
      </div>
      {loading ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : slides.length === 0 ? (
        <div className="rounded border p-4 text-sm text-neutral-500">No slides yet.</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={slides.map((s) => s.id!)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y rounded border">
              {slides.map((s) => (
                <SortableRow
                  key={s.id}
                  row={s}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onToggle={toggleActive}
                  onMove={move}
                  index={slides
                    .filter((h) => h.type !== 'hero')
                    .findIndex((n) => n.id === s.id)}
                  lastIndex={slides.filter((h) => h.type !== 'hero').length - 1}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

type SortableRowProps = {
  row: SlideRow;
  onEdit: (r: SlideRow) => void;
  onDelete: (r: SlideRow) => void;
  onToggle: (r: SlideRow) => void;
  onMove: (r: SlideRow, dir: 'up' | 'down') => void;
  index: number;
  lastIndex: number;
};

function SortableRow({ row, onEdit, onDelete, onToggle, onMove, index, lastIndex }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: row.id!,
    disabled: row.type === 'hero',
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties;
  const locked = row.type === 'hero';
  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-3 p-3">
      <span
        {...attributes}
        {...listeners}
        className={`cursor-grab ${locked ? 'opacity-50' : ''}`}
      >
        <ArrowsUpDownIcon className="h-5 w-5" />
      </span>
      <div className="flex flex-col">
        <button disabled={locked || index <= 0} onClick={() => onMove(row, 'up')}>
          <ChevronUpIcon className="h-4 w-4" />
        </button>
        <button disabled={locked || index === lastIndex} onClick={() => onMove(row, 'down')}>
          <ChevronDownIcon className="h-4 w-4" />
        </button>
      </div>
      <span className="text-xs px-2 py-1 rounded border">{row.type}</span>
      <div className="flex-1">{row.title}</div>
      {locked ? (
        <span className="px-2 py-1 text-xs border rounded">Locked</span>
      ) : (
        <label className="inline-flex items-center gap-1 text-sm">
          <input type="checkbox" checked={row.is_active ?? true} onChange={() => onToggle(row)} />
          Active
        </label>
      )}
      <button onClick={() => onEdit(row)} className="ml-2 px-3 py-1 rounded border" disabled={locked}>
        Edit
      </button>
      <button
        onClick={() => onDelete(row)}
        className="ml-2 px-3 py-1 rounded border text-red-600"
        disabled={locked}
      >
        Delete
      </button>
    </li>
  );
}

