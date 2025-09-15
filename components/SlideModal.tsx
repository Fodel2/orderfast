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

const PREVIEW_PADDING_X = 32;
const PREVIEW_PADDING_Y = 24;

const cloneCfg = (cfg: SlideCfg): SlideCfg => JSON.parse(JSON.stringify(cfg));

function defaultBackground(): SlideCfg["background"] {
  return {
    type: "color",
    color: "#111",
    overlay: { color: "#000", opacity: 0.25 },
  };
}

function clampPct(v: number) {
  if (Number.isNaN(v)) return 0;
  return Math.min(100, Math.max(0, v));
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
  if (!raw) return defaultBackground();
  if (raw.type === "color" || raw.type === "image" || raw.type === "video") {
    return {
      type: raw.type,
      color: raw.color,
      url: raw.url,
      overlay: raw.overlay
        ? { color: raw.overlay.color, opacity: raw.overlay.opacity ?? 0.25 }
        : undefined,
    };
  }
  if (raw.kind === "image" || raw.kind === "video") {
    return {
      type: raw.kind,
      url: raw.value ?? undefined,
      overlay: raw.overlay
        ? {
            color: raw.overlayColor || "#000",
            opacity: raw.overlayOpacity ?? 0.25,
          }
        : undefined,
    };
  }
  return {
    type: "color",
    color: raw.value || "#111",
    overlay: raw.overlay
      ? {
          color: raw.overlayColor || "#000",
          opacity: raw.overlayOpacity ?? 0.25,
        }
      : undefined,
  };
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
  const [activeDevice, setActiveDevice] = useState<DeviceKind>("desktop");
  const [editInPreview, setEditInPreview] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
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
  const dragTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setCfg(normalizeConfig(initialCfg ?? {}, slide));
    setSelectedId(null);
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

  useEffect(() => {
    return () => {
      if (dragTimeoutRef.current) {
        window.clearTimeout(dragTimeoutRef.current);
      }
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
    updateCfg((prev) => ({ ...prev, blocks: [...prev.blocks, block] }));
    setSelectedId(id);
  };

  const removeBlock = (id: string) => {
    updateCfg((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((b) => b.id !== id),
    }));
    setSelectedId((prev) => (prev === id ? null : prev));
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

  const setBackground = (
    patch: Partial<NonNullable<SlideCfg["background"]>>,
  ) => {
    updateCfg((prev) => ({
      ...prev,
      background: { ...prev.background, ...patch },
    }));
  };

  const handleDraggingChange = useCallback((dragging: boolean) => {
    if (dragging) {
      if (dragTimeoutRef.current) {
        window.clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = null;
      }
      setIsDragging(true);
      return;
    }
    if (dragTimeoutRef.current) {
      window.clearTimeout(dragTimeoutRef.current);
    }
    dragTimeoutRef.current = window.setTimeout(() => {
      setIsDragging(false);
      dragTimeoutRef.current = null;
    }, 150);
  }, []);

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
    const computed = Math.min(widthScale, heightScale);
    if (!Number.isFinite(computed) || computed <= 0) return 1;
    return computed;
  }, [availableWidth, availableHeight, deviceHeight, deviceWidth]);

  const selectedBlock = useMemo(
    () => cfg.blocks.find((b) => b.id === selectedId) || null,
    [cfg.blocks, selectedId],
  );

  useEffect(() => {
    if (selectedBlock) return;
    if (dragTimeoutRef.current) {
      window.clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }
    setIsDragging(false);
  }, [selectedBlock]);

  const frame = selectedBlock ? ensureFrame(selectedBlock, activeDevice) : null;

  const linkOptions = useMemo(
    () => [...ROUTE_OPTIONS, ...customPages, "custom"],
    [customPages],
  );

  const selectionLabel = selectedBlock ? `${selectedBlock.kind}` : "None";
  const inspectorVisible = Boolean(selectedBlock) && !isDragging;
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
              <aside className="w-64 shrink-0 border-r bg-white">
                <div className="h-full space-y-4 overflow-y-auto p-4">
                  <div>
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
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-neutral-600">
                      Layers
                    </h3>
                    <div className="space-y-2">
                      {cfg.blocks.map((block, index) => (
                        <div
                          key={block.id}
                          className={`rounded border px-2 py-2 text-sm transition hover:border-emerald-400 ${
                            block.id === selectedId
                              ? "border-emerald-500 bg-emerald-50"
                              : "border-neutral-200"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedId(block.id)}
                            className="flex w-full items-center justify-between text-left"
                          >
                            <span className="capitalize">{block.kind}</span>
                            <span className="text-xs text-neutral-500">
                              {index + 1}
                            </span>
                          </button>
                          <div className="mt-2 flex justify-end text-xs">
                            <button
                              type="button"
                              onClick={() => removeBlock(block.id)}
                              className="rounded border px-2 py-1 text-red-600"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-neutral-600">
                      Device
                    </h3>
                    <div className="flex gap-2">
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
                  </div>
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
                        onSelect={setSelectedId}
                        activeDevice={activeDevice}
                        editInPreview={editInPreview}
                        scale={scale}
                        onDraggingChange={handleDraggingChange}
                      />
                    )}
                  </div>
                </div>
              </main>
              {inspectorVisible && (
                <div className="border-t bg-white">
                  <div className="max-h-[60vh] overflow-y-auto p-4 space-y-6">
                    <section>
                      <h3 className="text-sm font-semibold text-neutral-600">
                        Background
                      </h3>
                      <div className="mt-3 space-y-3 text-sm">
                        <label className="block">
                          <span className="text-xs font-medium text-neutral-500">
                            Type
                          </span>
                          <select
                            value={cfg.background?.type || "color"}
                            onChange={(e) =>
                              setBackground({
                                type: e.target
                                  .value as SlideCfg["background"]["type"],
                                url: undefined,
                              })
                            }
                            className="mt-1 w-full rounded border px-2 py-1"
                          >
                            <option value="color">Color</option>
                            <option value="image">Image</option>
                            <option value="video">Video</option>
                          </select>
                        </label>
                        {cfg.background?.type === "color" && (
                          <label className="block">
                            <span className="text-xs font-medium text-neutral-500">
                              Color
                            </span>
                            <input
                              type="color"
                              value={cfg.background?.color || "#111111"}
                              onChange={(e) =>
                                setBackground({ color: e.target.value })
                              }
                              className="mt-1 h-10 w-full rounded border"
                            />
                          </label>
                        )}
                        {cfg.background?.type !== "color" && (
                          <div className="space-y-2">
                            <label className="block text-xs font-medium text-neutral-500">
                              Media URL
                            </label>
                            <input
                              type="text"
                              value={cfg.background?.url || ""}
                              onChange={(e) =>
                                setBackground({ url: e.target.value })
                              }
                              className="w-full rounded border px-2 py-1 text-sm"
                              placeholder="https://"
                            />
                            <input
                              ref={imageInputRef}
                              type="file"
                              accept={
                                cfg.background?.type === "video"
                                  ? "video/*"
                                  : "image/*"
                              }
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleUpload(file, (url) =>
                                    setBackground({ url }),
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
                              <div className="text-xs text-neutral-500">
                                Uploading…
                              </div>
                            )}
                          </div>
                        )}
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={!!cfg.background?.overlay}
                            onChange={(e) =>
                              setBackground(
                                e.target.checked
                                  ? {
                                      overlay: {
                                        color: "#000000",
                                        opacity: 0.25,
                                      },
                                    }
                                  : { overlay: undefined },
                              )
                            }
                          />
                          Overlay
                        </label>
                        {cfg.background?.overlay && (
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={cfg.background.overlay.color || "#000000"}
                              onChange={(e) =>
                                setBackground({
                                  overlay: {
                                    color: e.target.value,
                                    opacity:
                                      cfg.background?.overlay?.opacity ?? 0.25,
                                  },
                                })
                              }
                              className="h-10 w-1/2 rounded border"
                            />
                            <input
                              type="number"
                              min={0}
                              max={0.9}
                              step={0.05}
                              value={cfg.background.overlay.opacity ?? 0.25}
                              onChange={(e) =>
                                setBackground({
                                  overlay: {
                                    color:
                                      cfg.background?.overlay?.color ??
                                      "#000000",
                                    opacity: Number(e.target.value),
                                  },
                                })
                              }
                              className="w-1/2 rounded border px-2 py-1 text-sm"
                            />
                          </div>
                        )}
                      </div>
                    </section>
                    <section>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-neutral-600">
                          Inspector
                        </h3>
                        <span className="text-xs text-neutral-500">
                          Selected: {selectionLabel}
                        </span>
                      </div>
                      {!selectedBlock ? (
                        <p className="mt-3 text-xs text-neutral-500">
                          Choose a block from the preview or layers list to edit
                          its properties.
                        </p>
                      ) : (
                        <div className="mt-3 space-y-4 text-sm">
                          {(selectedBlock.kind === "heading" ||
                            selectedBlock.kind === "subheading" ||
                            selectedBlock.kind === "text") && (
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
                      )}
                    </section>
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
