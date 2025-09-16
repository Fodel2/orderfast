import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import SlidesManager, {
  DEVICE_DIMENSIONS,
  type DeviceKind,
  type Frame,
  type SlideBackground,
  type SlideBlock,
  type SlideCfg,
  type SlidesManagerChangeOptions,
} from "./SlidesManager";
import Button from "@/components/ui/Button";
import { supabase } from "@/utils/supabaseClient";
import { STORAGE_BUCKET } from "@/lib/storage";
import { SlideRow } from "@/components/customer/home/SlidesContainer";

const ROUTE_OPTIONS = ["/menu", "/orders", "/more"];

const DEFAULT_FRAMES: Record<SlideBlock["kind"], Frame> = {
  heading: { x: 12, y: 12, w: 76, h: 18, r: 0 },
  subheading: { x: 12, y: 32, w: 70, h: 14, r: 0 },
  text: { x: 12, y: 48, w: 72, h: 24, r: 0 },
  button: { x: 12, y: 76, w: 40, h: 12, r: 0 },
  image: { x: 20, y: 20, w: 48, h: 40, r: 0 },
  quote: { x: 10, y: 50, w: 60, h: 22, r: 0 },
  gallery: { x: 6, y: 60, w: 88, h: 26, r: 0 },
  spacer: { x: 0, y: 0, w: 10, h: 10, r: 0 },
};

const TEXT_SIZES: { value: NonNullable<SlideBlock["size"]>; label: string }[] =
  [
    { value: "sm", label: "Small" },
    { value: "md", label: "Medium" },
    { value: "lg", label: "Large" },
    { value: "xl", label: "Extra large" },
  ];

const FONT_FAMILY_OPTIONS: { value: NonNullable<SlideBlock["fontFamily"]>; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "serif", label: "Serif" },
  { value: "sans", label: "Sans" },
  { value: "mono", label: "Mono" },
];

const FONT_WEIGHT_OPTIONS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

const BACKGROUND_STYLE_OPTIONS: { value: NonNullable<SlideBlock["bgStyle"]>; label: string }[] = [
  { value: "none", label: "None" },
  { value: "solid", label: "Solid" },
  { value: "glass", label: "Glass" },
];

const SIZE_TO_FONT_SIZE_PX: Record<NonNullable<SlideBlock["size"]>, number> = {
  sm: 18,
  md: 24,
  lg: 40,
  xl: 56,
};

const DEFAULT_TEXT_SHADOW: NonNullable<SlideBlock["textShadow"]> = {
  x: 0,
  y: 2,
  blur: 6,
  color: "#000000",
};

const BLOCK_KIND_LABELS: Record<SlideBlock["kind"], string> = {
  heading: "Heading",
  subheading: "Subheading",
  text: "Text",
  button: "Button",
  image: "Image",
  quote: "Quote",
  gallery: "Gallery",
  spacer: "Spacer",
};

const PREVIEW_PADDING_X = 16;
const PREVIEW_PADDING_Y = 16;

const cloneCfg = (cfg: SlideCfg): SlideCfg => JSON.parse(JSON.stringify(cfg));

function defaultBackground(): SlideCfg["background"] {
  return {
    type: "color",
    color: "#111",
    opacity: 1,
    overlay: { color: "#000", opacity: 0.25 },
  };
}

function clampPct(v: number) {
  if (Number.isNaN(v)) return 0;
  return Math.min(100, Math.max(0, v));
}

function clamp01(v: number) {
  if (Number.isNaN(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

function clampRange(v: number, min: number, max: number) {
  if (Number.isNaN(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function getDefaultFrame(kind: SlideBlock["kind"]): Frame {
  return { ...DEFAULT_FRAMES[kind] };
}

function ensureFrame(block: SlideBlock, device: DeviceKind): Frame {
  return block.frames[device]
    ? { ...block.frames[device]! }
    : getDefaultFrame(block.kind);
}

function convertLegacyFrame(pos: any): Frame {
  const w = typeof pos?.wPct === "number" ? clampPct(pos.wPct) : 40;
  const h = typeof pos?.hPct === "number" ? clampPct(pos.hPct) : 20;
  const cx = typeof pos?.xPct === "number" ? clampPct(pos.xPct) : 50;
  const cy = typeof pos?.yPct === "number" ? clampPct(pos.yPct) : 50;
  const x = clampPct(cx - w / 2);
  const y = clampPct(cy - h / 2);
  const r = typeof pos?.rotateDeg === "number" ? pos.rotateDeg : 0;
  return { x, y, w, h, r };
}

function normalizeBackground(raw: any): SlideCfg["background"] {
  if (raw === null) return { type: "none" };
  if (!raw) return defaultBackground();
  const overlayFrom = (source: any) => {
    if (!source) return undefined;
    const overlay = source.overlay ?? source;
    const hasOverlay =
      overlay &&
      (typeof overlay.color === "string" ||
        typeof overlay.opacity === "number" ||
        typeof overlay.overlayColor === "string" ||
        typeof overlay.overlayOpacity === "number");
    if (!hasOverlay) return undefined;
    const color =
      typeof overlay.color === "string"
        ? overlay.color
        : typeof overlay.overlayColor === "string"
          ? overlay.overlayColor
          : "#000000";
    const opacitySource =
      typeof overlay.opacity === "number"
        ? overlay.opacity
        : typeof overlay.overlayOpacity === "number"
          ? overlay.overlayOpacity
          : 0.25;
    return { color, opacity: clamp01(opacitySource) };
  };

  const type: SlideCfg["background"]["type"] =
    raw.type ?? raw.kind ?? "color";
  if (type === "none") {
    return { type: "none" };
  }
  if (type === "color") {
    const color =
      typeof raw.color === "string"
        ? raw.color
        : typeof raw.value === "string"
          ? raw.value
          : "#111111";
    const opacity =
      typeof raw.opacity === "number"
        ? clamp01(raw.opacity)
        : undefined;
    return {
      type: "color",
      color,
      opacity,
      overlay: overlayFrom(raw.overlay ? raw.overlay : undefined),
    };
  }
  const url =
    typeof raw.url === "string"
      ? raw.url
      : typeof raw.src === "string"
        ? raw.src
        : typeof raw.value === "string"
          ? raw.value
          : undefined;
  const fit: NonNullable<SlideCfg["background"]>["fit"] =
    raw.fit === "contain" ? "contain" : "cover";
  const focalX =
    typeof raw.focal?.x === "number"
      ? raw.focal.x
      : typeof raw.focal_x === "number"
        ? raw.focal_x
        : typeof raw.focalX === "number"
          ? raw.focalX
          : undefined;
  const focalY =
    typeof raw.focal?.y === "number"
      ? raw.focal.y
      : typeof raw.focal_y === "number"
        ? raw.focal_y
        : typeof raw.focalY === "number"
          ? raw.focalY
          : undefined;
  const focal =
    typeof focalX === "number" || typeof focalY === "number"
      ? { x: clamp01(focalX ?? 0.5), y: clamp01(focalY ?? 0.5) }
      : undefined;
  const blur =
    typeof raw.blur === "number" ? clampRange(raw.blur, 0, 12) : undefined;
  if (type === "image") {
    return {
      type: "image",
      url,
      fit,
      focal,
      blur,
      overlay: overlayFrom(raw.overlay ? raw.overlay : raw),
    };
  }
  if (type === "video") {
    const poster =
      typeof raw.poster === "string"
        ? raw.poster
        : typeof raw.thumbnail === "string"
          ? raw.thumbnail
          : undefined;
    const loop =
      typeof raw.loop === "boolean"
        ? raw.loop
        : typeof raw.autoloop === "boolean"
          ? raw.autoloop
          : true;
    const mute =
      typeof raw.mute === "boolean"
        ? raw.mute
        : typeof raw.muted === "boolean"
          ? raw.muted
          : true;
    const autoplay =
      typeof raw.autoplay === "boolean"
        ? raw.autoplay
        : typeof raw.autoPlay === "boolean"
          ? raw.autoPlay
          : true;
    return {
      type: "video",
      url,
      fit,
      focal,
      blur,
      poster,
      loop,
      mute,
      autoplay,
      overlay: overlayFrom(raw.overlay ? raw.overlay : raw),
    };
  }
  return defaultBackground();
}

function normalizeBlock(raw: any, positions?: Record<string, any>): SlideBlock {
  const kind: SlideBlock["kind"] = raw.kind ?? raw.type ?? "text";
  const frames: SlideBlock["frames"] = {};
  if (raw.frames && typeof raw.frames === "object") {
    (Object.keys(raw.frames) as DeviceKind[]).forEach((device) => {
      const f = raw.frames[device];
      if (f) {
        frames[device] = {
          x: clampPct(f.x ?? f.xPct ?? DEFAULT_FRAMES[kind].x),
          y: clampPct(f.y ?? f.yPct ?? DEFAULT_FRAMES[kind].y),
          w: clampPct(f.w ?? f.wPct ?? DEFAULT_FRAMES[kind].w),
          h: clampPct(f.h ?? f.hPct ?? DEFAULT_FRAMES[kind].h),
          r:
            typeof f.r === "number"
              ? f.r
              : typeof f.rotateDeg === "number"
                ? f.rotateDeg
                : DEFAULT_FRAMES[kind].r,
        };
      }
    });
  }
  if (Object.keys(frames).length === 0) {
    const legacy = positions?.[raw.id];
    if (legacy) {
      const converted = convertLegacyFrame(legacy);
      frames.mobile = converted;
      frames.tablet = converted;
      frames.desktop = converted;
    } else {
      frames.desktop = getDefaultFrame(kind);
    }
  }

  const block: SlideBlock = {
    id: raw.id || crypto.randomUUID(),
    kind,
    frames,
    text: raw.text ?? raw.label ?? "",
    href: raw.href,
    src: raw.src || raw.url,
    color: raw.color,
    align: raw.align,
    size: raw.size,
    buttonVariant: raw.buttonVariant,
    fit: raw.fit,
    author: raw.author,
    items: Array.isArray(raw.items)
      ? raw.items
      : Array.isArray(raw.images)
        ? raw.images.map((src: string) => ({ src }))
        : undefined,
    height: raw.height,
    locked: Boolean(raw.locked),
  };

  if (kind === "gallery" && !block.items) block.items = [];
  if (kind === "image" && !block.fit) block.fit = "cover";
  if (kind === "heading" && !block.size) block.size = "xl";
  if (kind === "subheading" && !block.size) block.size = "md";
  if (kind === "text" && !block.size) block.size = "sm";
  if (kind === "button" && !block.text) block.text = "Button";
  if (
    (kind === "heading" || kind === "subheading" || kind === "text") &&
    !block.color
  ) {
    block.color = "#ffffff";
  }

  if (
    kind === "heading" ||
    kind === "subheading" ||
    kind === "text"
  ) {
    const content =
      typeof raw.content === "string"
        ? raw.content
        : typeof block.text === "string"
          ? block.text
          : "";
    block.content = content;
    block.text = content;
  }

  if (kind === "heading" || kind === "text") {
    const fontFamilyValue =
      typeof raw.fontFamily === "string"
        ? (raw.fontFamily.toLowerCase() as SlideBlock["fontFamily"])
        : block.fontFamily;
    block.fontFamily =
      fontFamilyValue &&
      FONT_FAMILY_OPTIONS.some((opt) => opt.value === fontFamilyValue)
        ? fontFamilyValue
        : "default";
    const fallbackWeight = kind === "heading" ? 700 : 400;
    block.fontWeight =
      typeof raw.fontWeight === "number"
        ? raw.fontWeight
        : typeof block.fontWeight === "number"
          ? block.fontWeight
          : fallbackWeight;
    const fontSizeFallback =
      typeof raw.fontSize === "number"
        ? raw.fontSize
        : block.size
          ? SIZE_TO_FONT_SIZE_PX[block.size]
          : kind === "heading"
            ? 56
            : 16;
    block.fontSize = fontSizeFallback;
    if (typeof raw.lineHeight === "number") {
      block.lineHeight = raw.lineHeight;
    }
    block.lineHeightUnit =
      raw.lineHeightUnit === "px" || raw.lineHeightUnit === "em"
        ? raw.lineHeightUnit
        : block.lineHeightUnit ?? "em";
    if (typeof raw.letterSpacing === "number") {
      block.letterSpacing = raw.letterSpacing;
    }
    const textColor =
      typeof raw.textColor === "string"
        ? raw.textColor
        : block.color || "#000000";
    block.textColor = textColor;
    block.color = textColor;
    if (raw.textShadow && typeof raw.textShadow === "object") {
      const shadow = raw.textShadow;
      const x = typeof shadow.x === "number" ? shadow.x : DEFAULT_TEXT_SHADOW.x;
      const y = typeof shadow.y === "number" ? shadow.y : DEFAULT_TEXT_SHADOW.y;
      const blur =
        typeof shadow.blur === "number" ? shadow.blur : DEFAULT_TEXT_SHADOW.blur;
      const color =
        typeof shadow.color === "string"
          ? shadow.color
          : DEFAULT_TEXT_SHADOW.color;
      block.textShadow = { x, y, blur, color };
    } else if (raw.textShadow === null || raw.textShadow === false) {
      block.textShadow = null;
    } else if (block.textShadow === undefined) {
      block.textShadow = null;
    }
    const bgStyleValue = raw.bgStyle;
    const normalizedBgStyle: SlideBlock["bgStyle"] =
      bgStyleValue === "solid" || bgStyleValue === "glass"
        ? bgStyleValue
        : "none";
    block.bgStyle = normalizedBgStyle;
    const bgColor =
      typeof raw.bgColor === "string"
        ? raw.bgColor
        : typeof raw.backgroundColor === "string"
          ? raw.backgroundColor
          : block.bgColor ?? "#000000";
    block.bgColor = bgColor;
    const opacitySource =
      typeof raw.bgOpacity === "number"
        ? raw.bgOpacity
        : typeof raw.opacity === "number"
          ? raw.opacity
          : block.bgOpacity ?? (normalizedBgStyle === "glass" ? 0.5 : 1);
    block.bgOpacity = clamp01(opacitySource);
    const radiusSource =
      typeof raw.radius === "number"
        ? raw.radius
        : typeof raw.cornerRadius === "number"
          ? raw.cornerRadius
          : block.radius ?? 0;
    block.radius = radiusSource;
    const paddingSource =
      typeof raw.padding === "number"
        ? raw.padding
        : typeof raw.pad === "number"
          ? raw.pad
          : block.padding ?? 0;
    block.padding = paddingSource;
  }

  return block;
}

function normalizeConfig(raw: any, slide: SlideRow): SlideCfg {
  const source = raw && typeof raw === "object" ? raw : {};
  const cfg: SlideCfg = {
    background: normalizeBackground(source.background),
    blocks: Array.isArray(source.blocks)
      ? source.blocks.map((b: any) => normalizeBlock(b, source.positions))
      : [],
  };

  if (cfg.blocks.length === 0) {
    const blocks: SlideBlock[] = [];
    if (slide.title) {
      blocks.push({
        id: crypto.randomUUID(),
        kind: "heading",
        text: slide.title,
        color: "#ffffff",
        size: "xl",
        frames: { desktop: getDefaultFrame("heading") },
      });
    }
    if (slide.subtitle) {
      blocks.push({
        id: crypto.randomUUID(),
        kind: "subheading",
        text: slide.subtitle,
        color: "#ffffff",
        size: "md",
        frames: { desktop: getDefaultFrame("subheading") },
      });
    }
    if (slide.cta_label) {
      blocks.push({
        id: crypto.randomUUID(),
        kind: "button",
        text: slide.cta_label,
        href: slide.cta_href ?? "/menu",
        frames: { desktop: getDefaultFrame("button") },
      });
    }
    cfg.blocks = blocks.length
      ? blocks
      : [
          {
            id: crypto.randomUUID(),
            kind: "heading",
            text: "New Slide",
            color: "#ffffff",
            size: "xl",
            frames: { desktop: getDefaultFrame("heading") },
          },
        ];
  }

  return cfg;
}

interface SlideModalProps {
  slide: SlideRow;
  initialCfg: SlideCfg | Record<string, any> | null;
  onSave: (cfg: SlideCfg) => Promise<void> | void;
  onClose: () => void;
}

export default function SlideModal({
  slide,
  initialCfg,
  onSave,
  onClose,
}: SlideModalProps) {
  const restaurantId = slide.restaurant_id;
  const [cfg, setCfg] = useState<SlideCfg>(() =>
    normalizeConfig(initialCfg ?? {}, slide),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [activeDevice, setActiveDevice] = useState<DeviceKind>("desktop");
  const [editInPreview, setEditInPreview] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [customPages, setCustomPages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const pastRef = useRef<SlideCfg[]>([]);
  const futureRef = useRef<SlideCfg[]>([]);
  const [, forceHistoryTick] = useState(0);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const blockImageInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const videoPosterInputRef = useRef<HTMLInputElement | null>(null);
  const isManipulatingRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    setCfg(normalizeConfig(initialCfg ?? {}, slide));
    setSelectedId(null);
    setInspectorOpen(false);
    isManipulatingRef.current = false;
    pastRef.current = [];
    futureRef.current = [];
    forceHistoryTick((v) => v + 1);
  }, [initialCfg, slide]);

  useEffect(() => {
    if (!restaurantId) return;
    supabase
      .from("custom_pages")
      .select("slug")
      .eq("restaurant_id", restaurantId)
      .order("slug")
      .then(({ data }) => {
        if (data) setCustomPages(data.map((row) => `/p/${row.slug}`));
      });
  }, [restaurantId]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const node = previewContainerRef.current;
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      setPreviewSize({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setPreviewSize({ width, height });
      }
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  const pushHistory = useCallback((snapshot: SlideCfg) => {
    pastRef.current.push(snapshot);
    if (pastRef.current.length > 100) pastRef.current.shift();
    futureRef.current = [];
    forceHistoryTick((v) => v + 1);
  }, []);

  const handlePreviewChange = useCallback(
    (next: SlideCfg, options?: SlidesManagerChangeOptions) => {
      setCfg((prev) => {
        if (options?.commit) {
          pushHistory(cloneCfg(prev));
        }
        return next;
      });
    },
    [pushHistory],
  );

  const updateCfg = useCallback(
    (mutator: (prev: SlideCfg) => SlideCfg, commit = true) => {
      setCfg((prev) => {
        const next = mutator(prev);
        if (commit) {
          pushHistory(cloneCfg(prev));
        }
        return next;
      });
    },
    [pushHistory],
  );

  const undo = useCallback(() => {
    setCfg((current) => {
      const previous = pastRef.current.pop();
      if (!previous) return current;
      futureRef.current.push(cloneCfg(current));
      forceHistoryTick((v) => v + 1);
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    setCfg((current) => {
      const next = futureRef.current.pop();
      if (!next) return current;
      pastRef.current.push(cloneCfg(current));
      forceHistoryTick((v) => v + 1);
      return next;
    });
  }, []);

  const addBlock = (kind: SlideBlock["kind"]) => {
    const id = crypto.randomUUID();
    const frame = getDefaultFrame(kind);
    const block: SlideBlock = {
      id,
      kind,
      text:
        kind === "heading"
          ? "Add a headline"
          : kind === "subheading"
            ? "Add a subtitle"
            : kind === "text"
              ? "Write some supporting text"
              : kind === "button"
                ? "Tap me"
                : kind === "quote"
                  ? "Add a quote from a happy guest"
                  : "",
      href: kind === "button" ? "/menu" : undefined,
      frames: { [activeDevice]: frame },
      color:
        kind === "heading" || kind === "subheading" || kind === "text"
          ? "#ffffff"
          : undefined,
      size:
        kind === "heading"
          ? "xl"
          : kind === "subheading"
            ? "md"
            : kind === "text"
              ? "sm"
              : undefined,
      fit: kind === "image" ? "cover" : undefined,
      items: kind === "gallery" ? [] : undefined,
    };
    if (kind === "heading" || kind === "text") {
      const initialContent = block.text ?? "";
      block.content = initialContent;
      block.fontFamily = "default";
      block.fontWeight = kind === "heading" ? 700 : 400;
      block.fontSize = block.size
        ? SIZE_TO_FONT_SIZE_PX[block.size]
        : kind === "heading"
          ? 56
          : 16;
      block.lineHeightUnit = "em";
      block.textColor = block.color ?? "#ffffff";
      block.color = block.textColor;
      block.textShadow = null;
      block.bgStyle = "none";
      block.bgColor = "#000000";
      block.bgOpacity = 1;
      block.radius = 0;
      block.padding = 0;
    }
    updateCfg((prev) => ({ ...prev, blocks: [...prev.blocks, block] }));
    handleSelectBlock(id);
    setInspectorOpen(true);
  };

  const removeBlock = (id: string) => {
    updateCfg((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((b) => b.id !== id),
    }));
    if (selectedIdRef.current === id) {
      handleSelectBlock(null);
    }
  };

  const moveBlock = (id: string, direction: -1 | 1) => {
    updateCfg((prev) => {
      const idx = prev.blocks.findIndex((b) => b.id === id);
      if (idx === -1) return prev;
      const swap = idx + direction;
      if (swap < 0 || swap >= prev.blocks.length) return prev;
      const blocks = [...prev.blocks];
      const [item] = blocks.splice(idx, 1);
      blocks.splice(swap, 0, item);
      return { ...prev, blocks };
    });
  };

  const patchBlock = (
    id: string,
    patch: Partial<SlideBlock>,
    commit = true,
  ) => {
    updateCfg(
      (prev) => ({
        ...prev,
        blocks: prev.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      }),
      commit,
    );
  };

  const updateFrameField = (id: string, field: keyof Frame, value: number) => {
    updateCfg((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => {
        if (b.id !== id) return b;
        const existing = ensureFrame(b, activeDevice);
        const nextFrame: Frame = {
          ...existing,
          [field]: field === "r" ? value : clampPct(value),
        };
        return {
          ...b,
          frames: {
            ...b.frames,
            [activeDevice]: nextFrame,
          },
        };
      }),
    }));
  };

  const updateBackground = useCallback(
    (
      mutator: (
        prev: SlideCfg["background"] | undefined,
      ) => SlideCfg["background"] | undefined,
      commit = true,
    ) => {
      updateCfg(
        (prev) => ({
          ...prev,
          background: mutator(prev.background),
        }),
        commit,
      );
    },
    [updateCfg],
  );

  const handleManipulationChange = useCallback((manipulating: boolean) => {
    isManipulatingRef.current = manipulating;
    if (manipulating) {
      setInspectorOpen(false);
    }
  }, []);

  const handleSelectBlock = useCallback((id: string | null) => {
    setSelectedId(id);
    selectedIdRef.current = id;
    if (!id) {
      setInspectorOpen(false);
    }
  }, []);

  const openInspectorForSelection = useCallback(() => {
    if (isManipulatingRef.current) return;
    if (!selectedIdRef.current) return;
    setInspectorOpen(true);
  }, []);

  const handleCanvasClick = useCallback(() => {
    handleSelectBlock(null);
  }, [handleSelectBlock]);

  const handleLayerSelect = useCallback(
    (id: string) => {
      handleSelectBlock(id);
      if (!isManipulatingRef.current) {
        setInspectorOpen(true);
      }
    },
    [handleSelectBlock],
  );

  const handleDuplicateBlock = useCallback(
    (id: string) => {
      const newId = crypto.randomUUID();
      updateCfg((prev) => {
        const index = prev.blocks.findIndex((b) => b.id === id);
        if (index === -1) return prev;
        const source = prev.blocks[index];
        const clone: SlideBlock = JSON.parse(JSON.stringify(source));
        clone.id = newId;
        clone.locked = false;
        const blocks = [...prev.blocks];
        blocks.splice(index + 1, 0, clone);
        return { ...prev, blocks };
      });
      handleSelectBlock(newId);
      setInspectorOpen(true);
    },
    [handleSelectBlock, updateCfg],
  );

  const toggleBlockLock = useCallback(
    (id: string) => {
      updateCfg((prev) => ({
        ...prev,
        blocks: prev.blocks.map((block) =>
          block.id === id ? { ...block, locked: !block.locked } : block,
        ),
      }));
    },
    [updateCfg],
  );

  const handleInspectorDone = useCallback(() => {
    setInspectorOpen(false);
  }, []);

  const handleBackgroundTypeChange = useCallback(
    (type: SlideBackground["type"]) => {
      updateBackground((prev) => {
        if (type === "none") {
          return { type: "none" };
        }
        if (type === "color") {
          const prevColor = prev?.type === "color" ? prev : undefined;
          return {
            type: "color",
            color: prevColor?.color || "#111111",
            opacity:
              typeof prevColor?.opacity === "number"
                ? clamp01(prevColor.opacity)
                : 1,
          };
        }
        if (type === "image") {
          const prevImage = prev?.type === "image" ? prev : undefined;
          return {
            type: "image",
            url: prevImage?.url,
            fit: prevImage?.fit || "cover",
            focal: prevImage?.focal || { x: 0.5, y: 0.5 },
            overlay: prevImage?.overlay,
            blur:
              typeof prevImage?.blur === "number"
                ? clampRange(prevImage.blur, 0, 12)
                : 0,
          };
        }
        if (type === "video") {
          const prevVideo = prev?.type === "video" ? prev : undefined;
          return {
            type: "video",
            url: prevVideo?.url,
            fit: prevVideo?.fit || "cover",
            focal: prevVideo?.focal || { x: 0.5, y: 0.5 },
            overlay: prevVideo?.overlay,
            blur:
              typeof prevVideo?.blur === "number"
                ? clampRange(prevVideo.blur, 0, 12)
                : 0,
            poster: prevVideo?.poster,
            loop: prevVideo?.loop ?? true,
            mute: prevVideo?.mute ?? true,
            autoplay: prevVideo?.autoplay ?? true,
          };
        }
        return prev ?? defaultBackground();
      });
    },
    [updateBackground],
  );

  const handleUpload = async (file: File, onUrl: (url: string) => void) => {
    if (!restaurantId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `slides/${restaurantId}/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(data.path);
      if (pub?.publicUrl) onUrl(pub.publicUrl);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(cfg);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const { width: deviceWidth, height: deviceHeight } =
    DEVICE_DIMENSIONS[activeDevice] ?? DEVICE_DIMENSIONS.desktop;
  const availableWidth = Math.max(previewSize.width - PREVIEW_PADDING_X * 2, 0);
  const availableHeight = Math.max(previewSize.height - PREVIEW_PADDING_Y * 2, 0);
  const scale = useMemo(() => {
    if (availableWidth <= 0 || availableHeight <= 0) return 1;
    const widthScale = availableWidth / deviceWidth;
    const heightScale = availableHeight / deviceHeight;
    const computed = Math.min(widthScale, heightScale, 1);
    if (!Number.isFinite(computed) || computed <= 0) return 1;
    return computed;
  }, [availableWidth, availableHeight, deviceHeight, deviceWidth]);

  const selectedBlock = useMemo(
    () => cfg.blocks.find((b) => b.id === selectedId) || null,
    [cfg.blocks, selectedId],
  );

  useEffect(() => {
    if (!selectedBlock) {
      setInspectorOpen(false);
    }
  }, [selectedBlock]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleSelectBlock(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleSelectBlock]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const frame = selectedBlock ? ensureFrame(selectedBlock, activeDevice) : null;

  const linkOptions = useMemo(
    () => [...ROUTE_OPTIONS, ...customPages, "custom"],
    [customPages],
  );

  const selectionLabel = selectedBlock
    ? BLOCK_KIND_LABELS[selectedBlock.kind] ?? selectedBlock.kind
    : "None";
  const background = cfg.background;
  const backgroundType = background?.type ?? "color";
  const colorBackground = background?.type === "color" ? background : undefined;
  const imageBackground = background?.type === "image" ? background : undefined;
  const videoBackground = background?.type === "video" ? background : undefined;
  const hasPreviewBounds = previewSize.width > 0 && previewSize.height > 0;

  return (
    <div className="fixed inset-0 z-[80] flex">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-[81] m-4 flex w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] flex-1 overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex min-h-[80vh] w-full flex-col">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDrawerOpen((v) => !v)}
                className={`rounded border border-neutral-200 px-3 py-1 text-sm ${drawerOpen ? "border-emerald-500 bg-emerald-50" : ""}`}
                aria-pressed={drawerOpen}
              >
                Blocks
              </button>
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              >
                Redo
              </button>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editInPreview}
                  onChange={(e) => setEditInPreview(e.target.checked)}
                />
                Edit in preview
              </label>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <button
                onClick={onClose}
                className="rounded border px-3 py-1 text-sm"
              >
                Close
              </button>
            </div>
          </header>
          <div className="flex flex-1 overflow-hidden">
            {drawerOpen && (
              <aside className="w-72 shrink-0 border-r bg-white">
                <div className="h-full space-y-6 overflow-y-auto p-4">
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-neutral-600">
                      Device
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(["mobile", "tablet", "desktop"] as DeviceKind[]).map(
                        (device) => (
                          <button
                            key={device}
                            type="button"
                            onClick={() => setActiveDevice(device)}
                            className={`rounded border px-2 py-1 text-xs capitalize ${
                              activeDevice === device
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-neutral-200"
                            }`}
                          >
                            {device}
                          </button>
                        ),
                      )}
                    </div>
                  </section>
                  <section>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                      Blocks
                    </h3>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(
                        [
                          "heading",
                          "subheading",
                          "text",
                          "button",
                          "image",
                          "quote",
                          "gallery",
                          "spacer",
                        ] as SlideBlock["kind"][]
                      ).map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => addBlock(kind)}
                          className="rounded border px-2 py-1 text-left text-xs capitalize hover:border-emerald-500"
                        >
                          + {kind}
                        </button>
                      ))}
                    </div>
                  </section>
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-neutral-600">
                      Layers
                    </h3>
                    <div className="space-y-1">
                      {cfg.blocks.map((block, index) => (
                        <div
                          key={block.id}
                          className={`flex h-10 items-center gap-2 rounded border px-2 text-xs transition ${
                            block.id === selectedId
                              ? "border-emerald-500 bg-emerald-50"
                              : "border-neutral-200"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleLayerSelect(block.id)}
                            className="flex h-full flex-1 items-center gap-2 overflow-hidden text-left capitalize"
                          >
                            <span className="truncate">{block.kind}</span>
                            <span className="ml-auto text-[11px] text-neutral-500">
                              #{index + 1}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeBlock(block.id)}
                            className="rounded border px-2 py-1 text-[11px] text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-neutral-600">
                      Background
                    </h3>
                    <div className="space-y-3 text-sm">
                      <label className="block text-xs font-medium text-neutral-500">
                        Type
                        <select
                          value={backgroundType}
                          onChange={(e) =>
                            handleBackgroundTypeChange(
                              e.target.value as SlideBackground["type"],
                            )
                          }
                          className="mt-1 w-full rounded border px-2 py-1 text-sm"
                        >
                          <option value="none">None</option>
                          <option value="color">Color</option>
                          <option value="image">Image</option>
                          <option value="video">Video</option>
                        </select>
                      </label>
                      {backgroundType === "color" && (
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-neutral-500">
                            Color
                            <div className="mt-1 flex items-center gap-2">
                              <input
                                type="color"
                                value={colorBackground?.color || "#111111"}
                                onChange={(e) =>
                                  updateBackground((prev) => {
                                    const next: SlideBackground =
                                      prev?.type === "color"
                                        ? { ...prev }
                                        : { type: "color", color: "#111111", opacity: 1 };
                                    next.color = e.target.value;
                                    return next;
                                  })
                                }
                                className="h-9 w-9 rounded border"
                              />
                              <input
                                type="text"
                                value={colorBackground?.color || "#111111"}
                                onChange={(e) =>
                                  updateBackground((prev) => {
                                    const next: SlideBackground =
                                      prev?.type === "color"
                                        ? { ...prev }
                                        : { type: "color", color: "#111111", opacity: 1 };
                                    next.color = e.target.value;
                                    return next;
                                  })
                                }
                                className="flex-1 rounded border px-2 py-1 text-xs uppercase"
                              />
                            </div>
                          </label>
                          <label className="block text-xs font-medium text-neutral-500">
                            Opacity
                            <div className="mt-1 flex items-center gap-2">
                              <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={colorBackground?.opacity ?? 1}
                                onChange={(e) =>
                                  updateBackground((prev) => {
                                    const next: SlideBackground =
                                      prev?.type === "color"
                                        ? { ...prev }
                                        : { type: "color", color: "#111111", opacity: 1 };
                                    next.opacity = clamp01(Number(e.target.value));
                                    return next;
                                  })
                                }
                                className="flex-1"
                              />
                              <span className="w-12 text-right text-xs text-neutral-500">
                                {(colorBackground?.opacity ?? 1).toFixed(2)}
                              </span>
                            </div>
                          </label>
                        </div>
                      )}
                      {backgroundType === "image" && (
                        <div className="space-y-3">
                          <label className="block text-xs font-medium text-neutral-500">
                            Image URL
                            <input
                              type="text"
                              value={imageBackground?.url || ""}
                              onChange={(e) =>
                                updateBackground((prev) => {
                                  const next: SlideBackground =
                                    prev?.type === "image"
                                      ? { ...prev }
                                      : {
                                          type: "image",
                                          url: "",
                                          fit: "cover",
                                          focal: { x: 0.5, y: 0.5 },
                                          blur: 0,
                                        };
                                  next.url = e.target.value;
                                  return next;
                                })
                              }
                              className="mt-1 w-full rounded border px-2 py-1"
                              placeholder="https://"
                            />
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              ref={imageInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleUpload(file, (url) =>
                                    updateBackground((prev) => {
                                      const next: SlideBackground =
                                        prev?.type === "image"
                                          ? { ...prev }
                                          : {
                                              type: "image",
                                              url: "",
                                              fit: "cover",
                                              focal: { x: 0.5, y: 0.5 },
                                              blur: 0,
                                            };
                                      next.url = url;
                                      return next;
                                    }),
                                  );
                                  e.target.value = "";
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => imageInputRef.current?.click()}
                              className="rounded border px-3 py-1 text-xs"
                            >
                              Upload
                            </button>
                            {uploading && (
                              <span className="text-xs text-neutral-500">
                                Uploading…
                              </span>
                            )}
                          </div>
                          <label className="block text-xs font-medium text-neutral-500">
                            Fit
                            <select
                              value={imageBackground?.fit || "cover"}
                              onChange={(e) =>
                                updateBackground((prev) => {
                                  if (prev?.type !== "image")
                                    return {
                                      type: "image",
                                      url: "",
                                      fit: e.target.value as "cover" | "contain",
                                      focal: { x: 0.5, y: 0.5 },
                                      blur: 0,
                                    };
                                  return { ...prev, fit: e.target.value as "cover" | "contain" };
                                })
                              }
                              className="mt-1 w-full rounded border px-2 py-1"
                            >
                              <option value="cover">Cover</option>
                              <option value="contain">Contain</option>
                            </select>
                          </label>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <label className="block font-medium text-neutral-500">
                              Focal X
                              <input
                                type="number"
                                min={0}
                                max={1}
                                step={0.01}
                                value={imageBackground?.focal?.x ?? 0.5}
                                onChange={(e) =>
                                  updateBackground((prev) => {
                                    if (prev?.type !== "image") return prev;
                                    const nextFocal = {
                                      ...(prev.focal || { x: 0.5, y: 0.5 }),
                                      x: clamp01(Number(e.target.value)),
                                    };
                                    return { ...prev, focal: nextFocal };
                                  })
                                }
                                className="mt-1 w-full rounded border px-2 py-1"
                              />
                            </label>
                            <label className="block font-medium text-neutral-500">
                              Focal Y
                              <input
                                type="number"
                                min={0}
                                max={1}
                                step={0.01}
                                value={imageBackground?.focal?.y ?? 0.5}
                                onChange={(e) =>
                                  updateBackground((prev) => {
                                    if (prev?.type !== "image") return prev;
                                    const nextFocal = {
                                      ...(prev.focal || { x: 0.5, y: 0.5 }),
                                      y: clamp01(Number(e.target.value)),
                                    };
                                    return { ...prev, focal: nextFocal };
                                  })
                                }
                                className="mt-1 w-full rounded border px-2 py-1"
                              />
                            </label>
                          </div>
                          <label className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                            <input
                              type="checkbox"
                              checked={Boolean(imageBackground?.overlay)}
                              onChange={(e) =>
                                updateBackground((prev) => {
                                  if (prev?.type !== "image") return prev;
                                  if (!e.target.checked) {
                                    return { ...prev, overlay: undefined };
                                  }
                                  return {
                                    ...prev,
                                    overlay: {
                                      color: prev.overlay?.color || "#000000",
                                      opacity: prev.overlay?.opacity ?? 0.25,
                                    },
                                  };
                                })
                              }
                            />
                            Overlay
                          </label>
                          {imageBackground?.overlay && (
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="color"
                                value={imageBackground.overlay.color}
                                onChange={(e) =>
                                  updateBackground((prev) => {
                                    if (prev?.type !== "image") return prev;
                                    return {
                                      ...prev,
                                      overlay: {
                                        color: e.target.value,
                                        opacity: prev.overlay?.opacity ?? 0.25,
                                      },
                                    };
                                  })
                                }
                                className="h-9 w-full rounded border"
                              />
                              <input
                                type="number"
                                min={0}
                                max={1}
                                step={0.05}
                                value={imageBackground.overlay.opacity ?? 0.25}
                                onChange={(e) =>
                                  updateBackground((prev) => {
                                    if (prev?.type !== "image") return prev;
                                    return {
                                      ...prev,
                                      overlay: {
                                        color: prev.overlay?.color || "#000000",
                                        opacity: clamp01(Number(e.target.value)),
                                      },
                                    };
                                  })
                                }
                                className="rounded border px-2 py-1"
                              />
                            </div>
                          )}
                          <label className="block text-xs font-medium text-neutral-500">
                            Blur
                            <input
                              type="number"
                              min={0}
                              max={12}
                              value={imageBackground?.blur ?? 0}
                              onChange={(e) =>
                                updateBackground((prev) => {
                                  if (prev?.type !== "image") return prev;
                                  return {
                                    ...prev,
                                    blur: clampRange(Number(e.target.value), 0, 12),
                                  };
                                })
                              }
                              className="mt-1 w-full rounded border px-2 py-1"
                            />
                          </label>
                        </div>
                      )}
                      {backgroundType === "video" && (
                        <div className="space-y-3">
                          <label className="block text-xs font-medium text-neutral-500">
                            Video URL
                            <input
                              type="text"
                              value={videoBackground?.url || ""}
                              onChange={(e) =>
                                updateBackground((prev) => {
                                  const next: SlideBackground =
                                    prev?.type === "video"
                                      ? { ...prev }
                                      : {
                                          type: "video",
                                          url: "",
                                          fit: "cover",
                                          focal: { x: 0.5, y: 0.5 },
                                          blur: 0,
                                          loop: true,
                                          mute: true,
                                          autoplay: true,
                                        };
                                  next.url = e.target.value;
                                  return next;
                                })
                              }
                              className="mt-1 w-full rounded border px-2 py-1"
                              placeholder="https://"
                            />
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              ref={imageInputRef}
                              type="file"
                              accept="video/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleUpload(file, (url) =>
                                    updateBackground((prev) => {
                                      const next: SlideBackground =
                                        prev?.type === "video"
                                          ? { ...prev }
                                          : {
                                              type: "video",
                                              url: "",
                                              fit: "cover",
                                              focal: { x: 0.5, y: 0.5 },
                                              blur: 0,
                                              loop: true,
                                              mute: true,
                                              autoplay: true,
                                            };
                                      next.url = url;
                                      return next;
                                    }),
                                  );
                                  e.target.value = "";
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => imageInputRef.current?.click()}
                              className="rounded border px-3 py-1 text-xs"
                            >
                              Upload
                            </button>
                            {uploading && (
                              <span className="text-xs text-neutral-500">
                                Uploading…
                              </span>
                            )}
                          </div>
                          <label className="block text-xs font-medium text-neutral-500">
                            Poster URL
                            <input
                              type="text"
                              value={videoBackground?.poster || ""}
                              onChange={(e) =>
                                updateBackground((prev) => {
                                  if (prev?.type !== "video")
                                    return {
                                      type: "video",
                                      url: "",
                                      fit: "cover",
                                      focal: { x: 0.5, y: 0.5 },
                                      blur: 0,
                                      loop: true,
                                      mute: true,
                                      autoplay: true,
                                      poster: e.target.value,
                                    };
                                  return { ...prev, poster: e.target.value };
                                })
                              }
                              className="mt-1 w-full rounded border px-2 py-1"
                              placeholder="https://"
                            />
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              ref={videoPosterInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleUpload(file, (url) =>
                                    updateBackground((prev) => {
                                      if (prev?.type !== "video") return prev;
                                      return { ...prev, poster: url };
                                    }),
                                  );
                                  e.target.value = "";
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => videoPosterInputRef.current?.click()}
                              className="rounded border px-3 py-1 text-xs"
                            >
                              Upload poster
                            </button>
                          </div>
                          <label className="block text-xs font-medium text-neutral-500">
                            Fit
                            <select
                              value={videoBackground?.fit || "cover"}
                              onChange={(e) =>
                                updateBackground((prev) => {
                                  if (prev?.type !== "video")
                                    return {
                                      type: "video",
                                      url: prev?.url,
                                      fit: e.target.value as "cover" | "contain",
                                      focal: { x: 0.5, y: 0.5 },
                                      blur: 0,
                                      loop: true,
                                      mute: true,
                                      autoplay: true,
                                      poster: prev?.poster,
                                    };
                                  return { ...prev, fit: e.target.value as "cover" | "contain" };
                                })
                              }
                              className="mt-1 w-full rounded border px-2 py-1"
                            >
                              <option value="cover">Cover</option>
                              <option value="contain">Contain</option>
                            </select>
                          </label>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <label className="block font-medium text-neutral-500">
                              Focal X
                              <input
                                type="number"
                                min={0}
                                max={1}
                                step={0.01}
                                value={videoBackground?.focal?.x ?? 0.5}
                                onChange={(e) =>
                                  updateBackground((prev) => {
                                    if (prev?.type !== "video") return prev;
                                    const nextFocal = {
                                      ...(prev.focal || { x: 0.5, y: 0.5 }),
                                      x: clamp01(Number(e.target.value)),
                                    };
                                    return { ...prev, focal: nextFocal };
                                  })
                                }
                                className="mt-1 w-full rounded border px-2 py-1"
                              />
                            </label>
                            <label className="block font-medium text-neutral-500">
                              Focal Y
                              <input
                                type="number"
                                min={0}
                                max={1}
                                step={0.01}
                                value={videoBackground?.focal?.y ?? 0.5}
                                onChange={(e) =>
                                  updateBackground((prev) => {
                                    if (prev?.type !== "video") return prev;
                                    const nextFocal = {
                                      ...(prev.focal || { x: 0.5, y: 0.5 }),
                                      y: clamp01(Number(e.target.value)),
                                    };
                                    return { ...prev, focal: nextFocal };
                                  })
                                }
                                className="mt-1 w-full rounded border px-2 py-1"
                              />
                            </label>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs font-medium text-neutral-500">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={videoBackground?.loop ?? true}
                                onChange={(e) =>
                                  updateBackground((prev) => {
                                    if (prev?.type !== "video") return prev;
                                    return { ...prev, loop: e.target.checked };
                                  })
                                }
                              />
                              Loop
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={videoBackground?.mute ?? true}
                                onChange={(e) =>
                                  updateBackground((prev) => {
                                    if (prev?.type !== "video") return prev;
                                    return { ...prev, mute: e.target.checked };
                                  })
                                }
                              />
                              Mute
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={videoBackground?.autoplay ?? true}
                                onChange={(e) =>
                                  updateBackground((prev) => {
                                    if (prev?.type !== "video") return prev;
                                    return { ...prev, autoplay: e.target.checked };
                                  })
                                }
                              />
                              Autoplay
                            </label>
                          </div>
                          <label className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                            <input
                              type="checkbox"
                              checked={Boolean(videoBackground?.overlay)}
                              onChange={(e) =>
                                updateBackground((prev) => {
                                  if (prev?.type !== "video") return prev;
                                  if (!e.target.checked) {
                                    return { ...prev, overlay: undefined };
                                  }
                                  return {
                                    ...prev,
                                    overlay: {
                                      color: prev.overlay?.color || "#000000",
                                      opacity: prev.overlay?.opacity ?? 0.25,
                                    },
                                  };
                                })
                              }
                            />
                            Overlay
                          </label>
                          {videoBackground?.overlay && (
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="color"
                                value={videoBackground.overlay.color}
                                onChange={(e) =>
                                  updateBackground((prev) => {
                                    if (prev?.type !== "video") return prev;
                                    return {
                                      ...prev,
                                      overlay: {
                                        color: e.target.value,
                                        opacity: prev.overlay?.opacity ?? 0.25,
                                      },
                                    };
                                  })
                                }
                                className="h-9 w-full rounded border"
                              />
                              <input
                                type="number"
                                min={0}
                                max={1}
                                step={0.05}
                                value={videoBackground.overlay.opacity ?? 0.25}
                                onChange={(e) =>
                                  updateBackground((prev) => {
                                    if (prev?.type !== "video") return prev;
                                    return {
                                      ...prev,
                                      overlay: {
                                        color: prev.overlay?.color || "#000000",
                                        opacity: clamp01(Number(e.target.value)),
                                      },
                                    };
                                  })
                                }
                                className="rounded border px-2 py-1"
                              />
                            </div>
                          )}
                          <label className="block text-xs font-medium text-neutral-500">
                            Blur
                            <input
                              type="number"
                              min={0}
                              max={12}
                              value={videoBackground?.blur ?? 0}
                              onChange={(e) =>
                                updateBackground((prev) => {
                                  if (prev?.type !== "video") return prev;
                                  return {
                                    ...prev,
                                    blur: clampRange(Number(e.target.value), 0, 12),
                                  };
                                })
                              }
                              className="mt-1 w-full rounded border px-2 py-1"
                            />
                          </label>
                        </div>
                      )}
                      {backgroundType === "none" && (
                        <p className="text-xs text-neutral-500">
                          No background will be displayed for this slide.
                        </p>
                      )}
                    </div>
                  </section>
                </div>
              </aside>
            )}
            <div className="flex flex-1 flex-col overflow-hidden">
              <main className="flex flex-1 overflow-hidden bg-neutral-50">
                <div
                  ref={previewContainerRef}
                  className="flex h-full w-full min-h-0 overflow-hidden"
                >
                  <div
                    className="flex h-full w-full min-h-0 items-start justify-center overflow-hidden"
                    style={{
                      paddingTop: PREVIEW_PADDING_Y,
                      paddingBottom: PREVIEW_PADDING_Y,
                      paddingLeft: PREVIEW_PADDING_X,
                      paddingRight: PREVIEW_PADDING_X,
                    }}
                  >
                    {hasPreviewBounds && (
                      <SlidesManager
                        initialCfg={cfg}
                        onChange={handlePreviewChange}
                        editable={true}
                        selectedId={selectedId}
                        onSelectBlock={handleSelectBlock}
                        openInspector={openInspectorForSelection}
                        onCanvasClick={handleCanvasClick}
                        activeDevice={activeDevice}
                        editInPreview={editInPreview}
                        scale={scale}
                        onManipulationChange={handleManipulationChange}
                      />
                    )}
                  </div>
                </div>
              </main>
              {inspectorOpen && selectedBlock && (
                <div className="border-t bg-white">
                  <div className="max-h-[60vh] overflow-y-auto">
                    <div className="sticky top-0 z-10 border-b bg-white px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                            Block
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-neutral-900">
                              {selectionLabel}
                            </span>
                            {selectedBlock.locked && (
                              <span className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-neutral-600">
                                Locked
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDuplicateBlock(selectedBlock.id)}
                            className="rounded border px-3 py-1 text-sm"
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={() => removeBlock(selectedBlock.id)}
                            className="rounded border px-3 py-1 text-sm text-red-600"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleBlockLock(selectedBlock.id)}
                            className="rounded border px-3 py-1 text-sm"
                          >
                            {selectedBlock.locked ? "Unlock" : "Lock"}
                          </button>
                          <button
                            type="button"
                            onClick={handleInspectorDone}
                            className="rounded border px-3 py-1 text-sm"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6 px-4 pb-6 pt-4">
                      <section>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-neutral-600">
                          Inspector
                        </h3>
                        <span className="text-xs text-neutral-500">
                          Selected: {selectionLabel}
                        </span>
                      </div>
                      <div className="mt-3 space-y-4 text-sm">
                          {(selectedBlock.kind === "heading" ||
                            selectedBlock.kind === "text") && (
                            <>
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Content
                                </span>
                                <textarea
                                  rows={4}
                                  value={
                                    selectedBlock.content ?? selectedBlock.text ?? ""
                                  }
                                  onChange={(e) =>
                                    patchBlock(selectedBlock.id, {
                                      content: e.target.value,
                                      text: e.target.value,
                                    })
                                  }
                                  className="mt-1 w-full rounded border px-2 py-1"
                                />
                              </label>
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <label className="block">
                                  <span className="text-xs font-medium text-neutral-500">
                                    Font family
                                  </span>
                                  <select
                                    value={selectedBlock.fontFamily ?? "default"}
                                    onChange={(e) =>
                                      patchBlock(selectedBlock.id, {
                                        fontFamily: e.target.value as SlideBlock["fontFamily"],
                                      })
                                    }
                                    className="mt-1 w-full rounded border px-2 py-1"
                                  >
                                    {FONT_FAMILY_OPTIONS.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block">
                                  <span className="text-xs font-medium text-neutral-500">
                                    Font weight
                                  </span>
                                  <select
                                    value={String(
                                      selectedBlock.fontWeight ??
                                        (selectedBlock.kind === "heading" ? 700 : 400),
                                    )}
                                    onChange={(e) =>
                                      patchBlock(selectedBlock.id, {
                                        fontWeight: Number(e.target.value) || 400,
                                      })
                                    }
                                    className="mt-1 w-full rounded border px-2 py-1"
                                  >
                                    {FONT_WEIGHT_OPTIONS.map((weight) => (
                                      <option key={weight} value={weight}>
                                        {weight}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <label className="block">
                                  <span className="text-xs font-medium text-neutral-500">
                                    Font size (px)
                                  </span>
                                  <input
                                    type="number"
                                    min={1}
                                    value={
                                      selectedBlock.fontSize ??
                                      (selectedBlock.size
                                        ? SIZE_TO_FONT_SIZE_PX[selectedBlock.size]
                                        : selectedBlock.kind === "heading"
                                          ? 56
                                          : 16)
                                    }
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (value === "") {
                                        patchBlock(selectedBlock.id, {
                                          fontSize: undefined,
                                        });
                                        return;
                                      }
                                      const parsed = Number(value);
                                      patchBlock(selectedBlock.id, {
                                        fontSize: Number.isNaN(parsed)
                                          ? undefined
                                          : parsed,
                                      });
                                    }}
                                    className="mt-1 w-full rounded border px-2 py-1"
                                  />
                                </label>
                                <label className="block">
                                  <span className="text-xs font-medium text-neutral-500">
                                    Line height
                                  </span>
                                  <div className="mt-1 flex items-center gap-2">
                                    <input
                                      type="number"
                                      step={0.1}
                                      value={selectedBlock.lineHeight ?? ""}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === "") {
                                          patchBlock(selectedBlock.id, {
                                            lineHeight: undefined,
                                          });
                                          return;
                                        }
                                        const parsed = Number(value);
                                        patchBlock(selectedBlock.id, {
                                          lineHeight: Number.isNaN(parsed)
                                            ? undefined
                                            : parsed,
                                        });
                                      }}
                                      className="w-full rounded border px-2 py-1"
                                    />
                                    <select
                                      value={selectedBlock.lineHeightUnit ?? "em"}
                                      onChange={(e) =>
                                        patchBlock(selectedBlock.id, {
                                          lineHeightUnit: e.target.value as SlideBlock["lineHeightUnit"],
                                        })
                                      }
                                      className="rounded border px-2 py-1 text-xs"
                                    >
                                      <option value="em">em</option>
                                      <option value="px">px</option>
                                    </select>
                                  </div>
                                </label>
                              </div>
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Letter spacing (px)
                                </span>
                                <input
                                  type="number"
                                  step={0.1}
                                  value={selectedBlock.letterSpacing ?? ""}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === "") {
                                      patchBlock(selectedBlock.id, {
                                        letterSpacing: undefined,
                                      });
                                      return;
                                    }
                                    const parsed = Number(value);
                                    patchBlock(selectedBlock.id, {
                                      letterSpacing: Number.isNaN(parsed)
                                        ? undefined
                                        : parsed,
                                    });
                                  }}
                                  className="mt-1 w-full rounded border px-2 py-1"
                                />
                              </label>
                              <div>
                                <span className="text-xs font-medium text-neutral-500">
                                  Text color
                                </span>
                                <div className="mt-1 flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={
                                      selectedBlock.textColor ??
                                      selectedBlock.color ??
                                      "#000000"
                                    }
                                    onChange={(e) =>
                                      patchBlock(selectedBlock.id, {
                                        textColor: e.target.value,
                                        color: e.target.value,
                                      })
                                    }
                                    className="h-10 w-16 rounded border"
                                  />
                                  <input
                                    type="text"
                                    value={
                                      selectedBlock.textColor ??
                                      selectedBlock.color ??
                                      "#000000"
                                    }
                                    onChange={(e) =>
                                      patchBlock(selectedBlock.id, {
                                        textColor: e.target.value,
                                        color: e.target.value,
                                      })
                                    }
                                    className="w-full rounded border px-2 py-1 text-xs uppercase"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(selectedBlock.textShadow)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        patchBlock(selectedBlock.id, {
                                          textShadow:
                                            selectedBlock.textShadow ?? {
                                              ...DEFAULT_TEXT_SHADOW,
                                            },
                                        });
                                      } else {
                                        patchBlock(selectedBlock.id, {
                                          textShadow: null,
                                        });
                                      }
                                    }}
                                  />
                                  Text shadow
                                </label>
                                {selectedBlock.textShadow && (
                                  <div className="mt-2 grid grid-cols-2 gap-2">
                                    {([
                                      ["x", "X"],
                                      ["y", "Y"],
                                      ["blur", "Blur"],
                                    ] as const).map(([key, label]) => (
                                      <label key={key} className="block text-xs">
                                        <span className="font-medium text-neutral-500">
                                          {label}
                                        </span>
                                        <input
                                          type="number"
                                          value={selectedBlock.textShadow?.[key] ?? DEFAULT_TEXT_SHADOW[key]}
                                          onChange={(e) => {
                                            const value = Number(e.target.value);
                                            const current =
                                              selectedBlock.textShadow ?? {
                                                ...DEFAULT_TEXT_SHADOW,
                                              };
                                            patchBlock(selectedBlock.id, {
                                              textShadow: {
                                                ...current,
                                                [key]: Number.isNaN(value)
                                                  ? current[key]
                                                  : value,
                                              },
                                            });
                                          }}
                                          className="mt-1 w-full rounded border px-2 py-1"
                                        />
                                      </label>
                                    ))}
                                    <label className="col-span-2 block text-xs">
                                      <span className="font-medium text-neutral-500">
                                        Color
                                      </span>
                                      <div className="mt-1 flex items-center gap-2">
                                        <input
                                          type="color"
                                          value={
                                            selectedBlock.textShadow?.color ??
                                            DEFAULT_TEXT_SHADOW.color
                                          }
                                          onChange={(e) => {
                                            const current =
                                              selectedBlock.textShadow ?? {
                                                ...DEFAULT_TEXT_SHADOW,
                                              };
                                            patchBlock(selectedBlock.id, {
                                              textShadow: {
                                                ...current,
                                                color: e.target.value,
                                              },
                                            });
                                          }}
                                          className="h-10 w-16 rounded border"
                                        />
                                        <input
                                          type="text"
                                          value={
                                            selectedBlock.textShadow?.color ??
                                            DEFAULT_TEXT_SHADOW.color
                                          }
                                          onChange={(e) => {
                                            const current =
                                              selectedBlock.textShadow ?? {
                                                ...DEFAULT_TEXT_SHADOW,
                                              };
                                            patchBlock(selectedBlock.id, {
                                              textShadow: {
                                                ...current,
                                                color: e.target.value,
                                              },
                                            });
                                          }}
                                          className="w-full rounded border px-2 py-1 text-xs uppercase"
                                        />
                                      </div>
                                    </label>
                                  </div>
                                )}
                              </div>
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Background style
                                </span>
                                <select
                                  value={selectedBlock.bgStyle ?? "none"}
                                  onChange={(e) => {
                                    const value = e.target.value as SlideBlock["bgStyle"];
                                    if (value === "none") {
                                      patchBlock(selectedBlock.id, {
                                        bgStyle: "none",
                                      });
                                      return;
                                    }
                                    patchBlock(selectedBlock.id, {
                                      bgStyle: value,
                                      bgColor:
                                        selectedBlock.bgColor ?? "#000000",
                                      bgOpacity:
                                        selectedBlock.bgOpacity ??
                                        (value === "glass" ? 0.5 : 1),
                                      radius: selectedBlock.radius ?? 0,
                                      padding: selectedBlock.padding ?? 0,
                                    });
                                  }}
                                  className="mt-1 w-full rounded border px-2 py-1"
                                >
                                  {BACKGROUND_STYLE_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              {selectedBlock.bgStyle &&
                                selectedBlock.bgStyle !== "none" && (
                                  <div className="space-y-3">
                                    <div>
                                      <span className="text-xs font-medium text-neutral-500">
                                        Background color
                                      </span>
                                      <div className="mt-1 flex items-center gap-2">
                                        <input
                                          type="color"
                                          value={
                                            selectedBlock.bgColor ?? "#000000"
                                          }
                                          onChange={(e) =>
                                            patchBlock(selectedBlock.id, {
                                              bgColor: e.target.value,
                                            })
                                          }
                                          className="h-10 w-16 rounded border"
                                        />
                                        <input
                                          type="text"
                                          value={
                                            selectedBlock.bgColor ?? "#000000"
                                          }
                                          onChange={(e) =>
                                            patchBlock(selectedBlock.id, {
                                              bgColor: e.target.value,
                                            })
                                          }
                                          className="w-full rounded border px-2 py-1 text-xs uppercase"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-xs font-medium text-neutral-500">
                                        Opacity ({
                                          (selectedBlock.bgOpacity ??
                                            (selectedBlock.bgStyle === "glass"
                                              ? 0.5
                                              : 1)
                                          ).toFixed(2)
                                        })
                                      </span>
                                      <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.05}
                                        value={
                                          selectedBlock.bgOpacity ??
                                          (selectedBlock.bgStyle === "glass"
                                            ? 0.5
                                            : 1)
                                        }
                                        onChange={(e) => {
                                          const value = Number(e.target.value);
                                          patchBlock(
                                            selectedBlock.id,
                                            {
                                              bgOpacity: clamp01(value),
                                            },
                                            false,
                                          );
                                        }}
                                        className="mt-1 w-full"
                                      />
                                    </div>
                                    <label className="block">
                                      <span className="text-xs font-medium text-neutral-500">
                                        Corner radius (px)
                                      </span>
                                      <input
                                        type="number"
                                        min={0}
                                        value={selectedBlock.radius ?? 0}
                                        onChange={(e) => {
                                          const value = Number(e.target.value);
                                          patchBlock(selectedBlock.id, {
                                            radius: Number.isNaN(value)
                                              ? 0
                                              : value,
                                          });
                                        }}
                                        className="mt-1 w-full rounded border px-2 py-1"
                                      />
                                    </label>
                                    <label className="block">
                                      <span className="text-xs font-medium text-neutral-500">
                                        Padding (px)
                                      </span>
                                      <input
                                        type="number"
                                        min={0}
                                        value={selectedBlock.padding ?? 0}
                                        onChange={(e) => {
                                          const value = Number(e.target.value);
                                          patchBlock(selectedBlock.id, {
                                            padding: Number.isNaN(value)
                                              ? 0
                                              : value,
                                          });
                                        }}
                                        className="mt-1 w-full rounded border px-2 py-1"
                                      />
                                    </label>
                                  </div>
                                )}
                              <div>
                                <span className="text-xs font-medium text-neutral-500">
                                  Alignment
                                </span>
                                <div className="mt-1 flex gap-2">
                                  {(["left", "center", "right"] as const).map(
                                    (align) => (
                                      <button
                                        key={align}
                                        type="button"
                                        onClick={() =>
                                          patchBlock(selectedBlock.id, {
                                            align,
                                          })
                                        }
                                        className={`rounded border px-2 py-1 text-xs capitalize ${
                                          selectedBlock.align === align
                                            ? "border-emerald-500 bg-emerald-50"
                                            : ""
                                        }`}
                                      >
                                        {align}
                                      </button>
                                    ),
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                          {selectedBlock.kind === "subheading" && (
                            <>
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Text
                                </span>
                                <textarea
                                  rows={3}
                                  value={selectedBlock.text ?? ""}
                                  onChange={(e) =>
                                    patchBlock(selectedBlock.id, {
                                      text: e.target.value,
                                      content: e.target.value,
                                    })
                                  }
                                  className="mt-1 w-full rounded border px-2 py-1"
                                />
                              </label>
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Color
                                </span>
                                <input
                                  type="color"
                                  value={selectedBlock.color || "#ffffff"}
                                  onChange={(e) =>
                                    patchBlock(selectedBlock.id, {
                                      color: e.target.value,
                                      textColor: e.target.value,
                                    })
                                  }
                                  className="mt-1 h-10 w-full rounded border"
                                />
                              </label>
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Size
                                </span>
                                <select
                                  value={selectedBlock.size || "md"}
                                  onChange={(e) =>
                                    patchBlock(selectedBlock.id, {
                                      size: e.target.value as any,
                                    })
                                  }
                                  className="mt-1 w-full rounded border px-2 py-1"
                                >
                                  {TEXT_SIZES.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <div>
                                <span className="text-xs font-medium text-neutral-500">
                                  Alignment
                                </span>
                                <div className="mt-1 flex gap-2">
                                  {(["left", "center", "right"] as const).map(
                                    (align) => (
                                      <button
                                        key={align}
                                        type="button"
                                        onClick={() =>
                                          patchBlock(selectedBlock.id, {
                                            align,
                                          })
                                        }
                                        className={`rounded border px-2 py-1 text-xs capitalize ${
                                          selectedBlock.align === align
                                            ? "border-emerald-500 bg-emerald-50"
                                            : ""
                                        }`}
                                      >
                                        {align}
                                      </button>
                                    ),
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                          {selectedBlock.kind === "button" && (
                            <>
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Label
                                </span>
                                <input
                                  type="text"
                                  value={selectedBlock.text || ""}
                                  onChange={(e) =>
                                    patchBlock(selectedBlock.id, {
                                      text: e.target.value,
                                    })
                                  }
                                  className="mt-1 w-full rounded border px-2 py-1"
                                />
                              </label>
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Link
                                </span>
                                <select
                                  value={
                                    linkOptions.includes(
                                      selectedBlock.href ?? "",
                                    )
                                      ? selectedBlock.href
                                      : "custom"
                                  }
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === "custom") return;
                                    patchBlock(selectedBlock.id, {
                                      href: value,
                                    });
                                  }}
                                  className="mt-1 w-full rounded border px-2 py-1"
                                >
                                  {linkOptions.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt === "custom" ? "Custom URL" : opt}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              {(!selectedBlock.href ||
                                !linkOptions.includes(selectedBlock.href)) && (
                                <label className="block">
                                  <span className="text-xs font-medium text-neutral-500">
                                    Custom URL
                                  </span>
                                  <input
                                    type="text"
                                    value={selectedBlock.href || ""}
                                    onChange={(e) =>
                                      patchBlock(selectedBlock.id, {
                                        href: e.target.value,
                                      })
                                    }
                                    className="mt-1 w-full rounded border px-2 py-1"
                                    placeholder="https://"
                                  />
                                </label>
                              )}
                            </>
                          )}
                          {selectedBlock.kind === "image" && (
                            <>
                              <div className="space-y-2">
                                <span className="text-xs font-medium text-neutral-500">
                                  Image
                                </span>
                                {selectedBlock.src && (
                                  <img
                                    src={selectedBlock.src}
                                    alt=""
                                    className="h-28 w-full rounded object-cover"
                                  />
                                )}
                                <input
                                  ref={blockImageInputRef}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleUpload(file, (url) =>
                                        patchBlock(selectedBlock.id, {
                                          src: url,
                                        }),
                                      );
                                      e.target.value = "";
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    blockImageInputRef.current?.click()
                                  }
                                  className="rounded border px-3 py-1 text-xs"
                                >
                                  {selectedBlock.src
                                    ? "Replace image"
                                    : "Upload image"}
                                </button>
                                <label className="block">
                                  <span className="text-xs font-medium text-neutral-500">
                                    Fit
                                  </span>
                                  <select
                                    value={selectedBlock.fit || "cover"}
                                    onChange={(e) =>
                                      patchBlock(selectedBlock.id, {
                                        fit: e.target.value as
                                          | "cover"
                                          | "contain",
                                      })
                                    }
                                    className="mt-1 w-full rounded border px-2 py-1"
                                  >
                                    <option value="cover">Cover</option>
                                    <option value="contain">Contain</option>
                                  </select>
                                </label>
                              </div>
                            </>
                          )}
                          {selectedBlock.kind === "gallery" && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-xs text-neutral-500">
                                <span>
                                  {selectedBlock.items?.length || 0} images
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    galleryInputRef.current?.click()
                                  }
                                  className="rounded border px-2 py-1"
                                >
                                  Upload
                                </button>
                              </div>
                              <input
                                ref={galleryInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={async (e) => {
                                  const files = Array.from(
                                    e.target.files || [],
                                  );
                                  if (!files.length) return;
                                  const current = cfg.blocks.find(
                                    (b) => b.id === selectedBlock.id,
                                  );
                                  const nextItems = [...(current?.items || [])];
                                  for (const file of files) {
                                    // eslint-disable-next-line no-await-in-loop
                                    await handleUpload(file, (url) => {
                                      nextItems.push({ src: url });
                                    });
                                  }
                                  patchBlock(selectedBlock.id, {
                                    items: nextItems,
                                  });
                                  e.target.value = "";
                                }}
                              />
                              <div className="space-y-2">
                                {(selectedBlock.items || []).map(
                                  (item, index) => (
                                    <div
                                      key={item.src}
                                      className="flex items-center gap-2 text-xs"
                                    >
                                      <img
                                        src={item.src}
                                        alt=""
                                        className="h-12 w-12 rounded object-cover"
                                      />
                                      <div className="flex gap-1">
                                        <button
                                          type="button"
                                          className="rounded border px-2 py-1"
                                          disabled={index === 0}
                                          onClick={() => {
                                            const next = [
                                              ...(selectedBlock.items || []),
                                            ];
                                            const [moved] = next.splice(
                                              index,
                                              1,
                                            );
                                            next.splice(index - 1, 0, moved);
                                            patchBlock(selectedBlock.id, {
                                              items: next,
                                            });
                                          }}
                                        >
                                          Up
                                        </button>
                                        <button
                                          type="button"
                                          className="rounded border px-2 py-1"
                                          disabled={
                                            index ===
                                            (selectedBlock.items || []).length -
                                              1
                                          }
                                          onClick={() => {
                                            const next = [
                                              ...(selectedBlock.items || []),
                                            ];
                                            const [moved] = next.splice(
                                              index,
                                              1,
                                            );
                                            next.splice(index + 1, 0, moved);
                                            patchBlock(selectedBlock.id, {
                                              items: next,
                                            });
                                          }}
                                        >
                                          Down
                                        </button>
                                        <button
                                          type="button"
                                          className="rounded border px-2 py-1 text-red-600"
                                          onClick={() => {
                                            const next = (
                                              selectedBlock.items || []
                                            ).filter((_, i) => i !== index);
                                            patchBlock(selectedBlock.id, {
                                              items: next,
                                            });
                                          }}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          )}
                          {selectedBlock.kind === "quote" && (
                            <>
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Quote
                                </span>
                                <textarea
                                  rows={3}
                                  value={selectedBlock.text || ""}
                                  onChange={(e) =>
                                    patchBlock(selectedBlock.id, {
                                      text: e.target.value,
                                    })
                                  }
                                  className="mt-1 w-full rounded border px-2 py-1"
                                />
                              </label>
                              <label className="block">
                                <span className="text-xs font-medium text-neutral-500">
                                  Author
                                </span>
                                <input
                                  type="text"
                                  value={selectedBlock.author || ""}
                                  onChange={(e) =>
                                    patchBlock(selectedBlock.id, {
                                      author: e.target.value,
                                    })
                                  }
                                  className="mt-1 w-full rounded border px-2 py-1"
                                />
                              </label>
                            </>
                          )}
                          <div className="rounded border px-3 py-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                              Frame ({activeDevice})
                            </h4>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                              {frame && (
                                <>
                                  <label className="flex flex-col gap-1">
                                    <span>X%</span>
                                    <input
                                      type="number"
                                      value={frame.x}
                                      onChange={(e) =>
                                        updateFrameField(
                                          selectedBlock.id,
                                          "x",
                                          parseFloat(e.target.value),
                                        )
                                      }
                                      className="rounded border px-2 py-1"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span>Y%</span>
                                    <input
                                      type="number"
                                      value={frame.y}
                                      onChange={(e) =>
                                        updateFrameField(
                                          selectedBlock.id,
                                          "y",
                                          parseFloat(e.target.value),
                                        )
                                      }
                                      className="rounded border px-2 py-1"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span>Width%</span>
                                    <input
                                      type="number"
                                      value={frame.w}
                                      onChange={(e) =>
                                        updateFrameField(
                                          selectedBlock.id,
                                          "w",
                                          parseFloat(e.target.value),
                                        )
                                      }
                                      className="rounded border px-2 py-1"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span>Height%</span>
                                    <input
                                      type="number"
                                      value={frame.h}
                                      onChange={(e) =>
                                        updateFrameField(
                                          selectedBlock.id,
                                          "h",
                                          parseFloat(e.target.value),
                                        )
                                      }
                                      className="rounded border px-2 py-1"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span>Rotation°</span>
                                    <input
                                      type="number"
                                      value={frame.r}
                                      onChange={(e) =>
                                        updateFrameField(
                                          selectedBlock.id,
                                          "r",
                                          parseFloat(e.target.value),
                                        )
                                      }
                                      className="rounded border px-2 py-1"
                                    />
                                  </label>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                    </section>
                  </div>
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { SlideCfg } from "./SlidesManager";
