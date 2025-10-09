import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Columns,
  Image as ImageIcon,
  LayoutDashboard,
  Minus,
  MoveVertical,
  Redo2,
  SlidersHorizontal,
  Type,
  Undo2,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  Block,
  DeviceKind,
  HeaderBlock,
  ImageBlock,
  TextBlock,
  TwoColumnBlock,
  TwoColumnColumn,
} from './PageRenderer';
import WebpageBuilder from './webpage/WebpageBuilder';
import HeaderInspector from './webpage/HeaderInspector';
import AddBlockModal from './modals/AddBlockModal';
import { STORAGE_BUCKET } from '@/lib/storage';
import { supabase } from '@/lib/supabaseClient';
import InputUpload from '@/src/components/inspector/controls/InputUpload';
import { tokens } from '@/src/ui/tokens';

type Props = {
  open: boolean;
  onClose: () => void;
  pageId: string;
  restaurantId: string;
};

const headerVerticalPadding = tokens.spacing.xl * 5;

const createHeaderBlock = (): HeaderBlock => ({
  id: crypto.randomUUID(),
  type: 'header',
  title: 'Introduce your restaurant',
  subtitle:
    'Share your story, highlight seasonal dishes, or guide guests to the experiences that matter most.',
  tagline: 'A premium welcome',
  backgroundImageUrl: null,
  backgroundImageFit: 'cover',
  backgroundImagePosition: 'center',
  overlayEnabled: true,
  overlayColor: '#0f172a',
  overlayOpacity: 65,
  fontFamily: 'default',
  fontWeight: 700,
  titleFontSize: 48,
  titleLineHeight: 1.1,
  titleLetterSpacing: -1,
  titleColor: '#ffffff',
  subtitleColor: 'rgba(255, 255, 255, 0.9)',
  taglineColor: 'rgba(255, 255, 255, 0.75)',
  align: 'center',
  paddingTop: headerVerticalPadding,
  paddingBottom: headerVerticalPadding,
  fullWidth: true,
  parallaxEnabled: false,
});

const createTextBlock = (overrides?: Partial<TextBlock>): TextBlock => ({
  id: crypto.randomUUID(),
  type: 'text',
  text: 'Paragraph text',
  align: 'left',
  ...overrides,
});

const createImageBlock = (overrides?: Partial<ImageBlock>): ImageBlock => ({
  id: crypto.randomUUID(),
  type: 'image',
  src: 'https://placehold.co/1200x720',
  alt: 'Image',
  width: 960,
  radius: 'lg',
  ...overrides,
});

const TWO_COLUMN_LEFT_PLACEHOLDER = 'Showcase a featured dish or introduce your team.';
const TWO_COLUMN_RIGHT_PLACEHOLDER = 'Add supporting details and imagery to balance the layout.';

const createTwoColumnColumn = (overrides?: Partial<TwoColumnColumn>): TwoColumnColumn => ({
  text: createTextBlock({ text: 'Tell your story here.' }),
  image: null,
  wrapTextAroundImage: false,
  imageAlignment: 'top',
  imageSpacing: tokens.spacing.md,
  ...overrides,
});

const createTwoColumnBlock = (): TwoColumnBlock => ({
  id: crypto.randomUUID(),
  type: 'two-col',
  left: createTwoColumnColumn({
    text: createTextBlock({ text: TWO_COLUMN_LEFT_PLACEHOLDER }),
  }),
  right: createTwoColumnColumn({
    text: createTextBlock({ text: TWO_COLUMN_RIGHT_PLACEHOLDER }),
  }),
  ratio: '1-1',
  gap: tokens.spacing.lg,
  padding: tokens.spacing.lg,
});

const createDefaultBlocks = (): Block[] => [
  createHeaderBlock(),
  createTextBlock({ text: 'Start writing…' }),
];

type BlockPaletteKind = 'header' | 'text' | 'image' | 'two-col' | 'divider' | 'spacer';
type BlockCreatorKind = BlockPaletteKind | 'button';
type BlockIconComponent = LucideIcon;

const NEW_BLOCKS: Record<BlockCreatorKind, () => Block> = {
  header: () => createHeaderBlock(),
  text: () => createTextBlock(),
  image: () => createImageBlock(),
  button: () => ({
    id: crypto.randomUUID(),
    type: 'button',
    label: 'Button',
    href: '#',
    style: 'primary',
    align: 'left',
  }),
  divider: () => ({ id: crypto.randomUUID(), type: 'divider' }),
  spacer: () => ({ id: crypto.randomUUID(), type: 'spacer', height: 24 }),
  'two-col': () => createTwoColumnBlock(),
};

type BlockLibraryOption = {
  kind: BlockPaletteKind;
  title: string;
  description: string;
  icon: BlockIconComponent;
};

const BLOCK_LIBRARY: BlockLibraryOption[] = [
  {
    kind: 'header',
    title: 'Header',
    description: 'Hero section with background imagery, overlay, and typography controls.',
    icon: LayoutDashboard,
  },
  {
    kind: 'text',
    title: 'Text',
    description: 'Rich paragraph block for storytelling and descriptions.',
    icon: Type,
  },
  {
    kind: 'image',
    title: 'Image',
    description: 'Upload or link images with custom sizing and radius.',
    icon: ImageIcon,
  },
  {
    kind: 'two-col',
    title: 'Columns',
    description: 'Two-column layout ideal for text and imagery pairings.',
    icon: Columns,
  },
  {
    kind: 'divider',
    title: 'Divider',
    description: 'Subtle line to separate sections of content.',
    icon: Minus,
  },
  {
    kind: 'spacer',
    title: 'Spacer',
    description: 'Adjustable vertical spacing between blocks.',
    icon: MoveVertical,
  },
];

type DemoPage = {
  id: string;
  name: string;
  description: string;
  blocks: Block[];
};

const DEMO_PAGES: DemoPage[] = (() => {
  const brunchHeader = {
    ...createHeaderBlock(),
    id: crypto.randomUUID(),
    title: 'Brunch Club',
    subtitle: 'Weekend brunch reservations with champagne towers, live jazz, and sunlit patios.',
    tagline: 'Sunlit gatherings',
    backgroundImageUrl:
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&q=80',
    backgroundImagePosition: 'center' as const,
    overlayOpacity: 55,
    align: 'center' as const,
    parallaxEnabled: true,
  } satisfies HeaderBlock;

  const brunchIntro = createTextBlock({
    text: 'Sip seasonal cocktails, linger over chef-crafted plates, and make brunch the highlight of your weekend.',
    align: 'center',
  });

  const brunchColumns = {
    ...createTwoColumnBlock(),
    id: crypto.randomUUID(),
    ratio: '2-1' as const,
    gap: tokens.spacing.lg * 1.25,
    padding: tokens.spacing.xl,
    left: {
      ...createTwoColumnColumn(),
      text: createTextBlock({
        text: 'Our rotating menu celebrates peak-season produce, shared platters, and vibrant flavors inspired by coastal cafés.',
        align: 'left',
      }),
      image: null,
    },
    right: {
      ...createTwoColumnColumn(),
      text: createTextBlock({
        text: 'Pair your favorites with sparkling flights, artisan coffees, and curated playlists that set the tone for relaxed celebrations.',
        align: 'left',
      }),
      image: createImageBlock({
        src: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=1200&q=80',
        alt: 'Brunch spread with pancakes and fruit',
        width: 420,
        radius: 'lg',
      }),
      imageAlignment: 'bottom',
    },
  } satisfies TwoColumnBlock;

  const wrapHeader = {
    ...createHeaderBlock(),
    id: crypto.randomUUID(),
    title: 'The Wrap Shack',
    subtitle: 'Fast-casual wraps pressed to order with warm naan, crisp vegetables, and house-made sauces.',
    tagline: 'Crafted daily',
    backgroundImageUrl:
      'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?auto=format&fit=crop&w=1400&q=80',
    overlayColor: '#0f172a',
    overlayOpacity: 82,
    align: 'left' as const,
    parallaxEnabled: false,
  } satisfies HeaderBlock;

  const wrapStory = createTextBlock({
    text: 'Choose from bold global fillings, vegan specials, and toasted sides designed for the perfect handheld meal.',
    align: 'center',
  });

  const wrapImage = createImageBlock({
    src: 'https://images.unsplash.com/photo-1473093226795-af9932fe5856?auto=format&fit=crop&w=1400&q=80',
    alt: 'Gourmet wrap served on a wooden board',
    width: 880,
    radius: '2xl',
  });

  const wrapDivider: Block = { id: crypto.randomUUID(), type: 'divider' };

  return [
    {
      id: 'brunch-club',
      name: 'Brunch Club',
      description: 'Parallax hero with storytelling content and a column layout for featured highlights.',
      blocks: [brunchHeader, brunchIntro, brunchColumns],
    },
    {
      id: 'the-wrap-shack',
      name: 'The Wrap Shack',
      description: 'Bold overlay hero paired with a feature image and clean section divider for menu callouts.',
      blocks: [wrapHeader, wrapStory, wrapImage, wrapDivider],
    },
  ];
})();

const getUploadErrorMessage = (error: unknown) => {
  if (!error) return 'Unknown error';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in (error as Record<string, unknown>)) {
    return String((error as Record<string, unknown>).message);
  }
  return String(error);
};

const cloneText = (block: TextBlock | undefined) =>
  block
    ? ({
        ...block,
        id: crypto.randomUUID(),
      } satisfies TextBlock)
    : undefined;

const cloneImage = (block: ImageBlock | null | undefined) =>
  block
    ? ({
        ...block,
        id: crypto.randomUUID(),
      } satisfies ImageBlock)
    : null;

function cloneBlockWithIds(block: Block): Block {
  const baseId = crypto.randomUUID();
  switch (block.type) {
    case 'two-col':
      return {
        ...block,
        id: baseId,
        left: {
          ...block.left,
          text: cloneText(block.left.text),
          image: cloneImage(block.left.image),
        },
        right: {
          ...block.right,
          text: cloneText(block.right.text),
          image: cloneImage(block.right.image),
        },
      };
    case 'text':
      return { ...block, id: baseId } satisfies TextBlock;
    case 'image':
      return { ...block, id: baseId } satisfies ImageBlock;
    case 'button':
    case 'divider':
    case 'spacer':
    case 'header':
    default:
      return { ...block, id: baseId } as Block;
  }
}

const normalizeTextBlockValue = (value: any, fallbackText: string): TextBlock => {
  if (value && typeof value === 'object' && value.type === 'text') {
    const align = value.align === 'center' || value.align === 'right' ? value.align : 'left';
    return {
      id: typeof value.id === 'string' ? value.id : crypto.randomUUID(),
      type: 'text',
      text: typeof value.text === 'string' ? value.text : fallbackText,
      align,
    };
  }
  return createTextBlock({ text: fallbackText });
};

const normalizeImageBlockValue = (value: any): ImageBlock | null => {
  if (value && typeof value === 'object' && value.type === 'image' && typeof value.src === 'string' && value.src.length) {
    const radius: ImageBlock['radius'] = value.radius === 'lg' || value.radius === '2xl' ? value.radius : 'none';
    return {
      id: typeof value.id === 'string' ? value.id : crypto.randomUUID(),
      type: 'image',
      src: value.src,
      alt: typeof value.alt === 'string' ? value.alt : '',
      width: typeof value.width === 'number' ? value.width : undefined,
      radius,
    };
  }
  return null;
};

const normalizeTwoColumnColumn = (value: any, fallbackText: string): TwoColumnColumn => {
  if (Array.isArray(value)) {
    const textCandidate = value.find((entry) => entry?.type === 'text');
    const imageCandidate = value.find((entry) => entry?.type === 'image');
    return {
      text: normalizeTextBlockValue(textCandidate, fallbackText),
      image: normalizeImageBlockValue(imageCandidate),
      wrapTextAroundImage: false,
      imageAlignment: 'top',
      imageSpacing: tokens.spacing.md,
    };
  }

  if (!value || typeof value !== 'object') {
    return createTwoColumnColumn({ text: createTextBlock({ text: fallbackText }) });
  }

  const textSource = value.text ?? value.blocks?.find?.((entry: any) => entry?.type === 'text');
  const imageSource = value.image ?? value.blocks?.find?.((entry: any) => entry?.type === 'image');
  const normalizedImage = imageSource === null ? null : normalizeImageBlockValue(imageSource);
  const alignment: TwoColumnColumn['imageAlignment'] =
    value.imageAlignment === 'left' || value.imageAlignment === 'right' || value.imageAlignment === 'bottom'
      ? value.imageAlignment
      : 'top';
  const wrapEnabled = Boolean(normalizedImage && value.wrapTextAroundImage && (alignment === 'left' || alignment === 'right'));

  return {
    text: normalizeTextBlockValue(textSource, fallbackText),
    image: normalizedImage,
    wrapTextAroundImage: wrapEnabled,
    imageAlignment: alignment,
    imageSpacing: typeof value.imageSpacing === 'number' ? value.imageSpacing : tokens.spacing.md,
  };
};

const normalizeTwoColumnBlock = (value: any): TwoColumnBlock => {
  if (!value || typeof value !== 'object') {
    return createTwoColumnBlock();
  }

  const base = createTwoColumnBlock();
  const ratio: TwoColumnBlock['ratio'] = value.ratio === '1-2' || value.ratio === '2-1' ? value.ratio : '1-1';

  return {
    id: typeof value.id === 'string' ? value.id : base.id,
    type: 'two-col',
    left: normalizeTwoColumnColumn(value.left, TWO_COLUMN_LEFT_PLACEHOLDER),
    right: normalizeTwoColumnColumn(value.right, TWO_COLUMN_RIGHT_PLACEHOLDER),
    ratio,
    gap: typeof value.gap === 'number' ? value.gap : base.gap,
    padding: typeof value.padding === 'number' ? value.padding : base.padding,
  };
};

const normalizeHeaderBlock = (value: any): HeaderBlock => {
  if (!value || typeof value !== 'object') {
    return createHeaderBlock();
  }

  const base = createHeaderBlock();

  return {
    ...base,
    ...value,
    id: typeof value.id === 'string' ? value.id : base.id,
    type: 'header',
  };
};

const normalizeBlock = (value: any): Block | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  switch (value.type) {
    case 'header':
      return normalizeHeaderBlock(value);
    case 'text':
      return normalizeTextBlockValue(value, '');
    case 'image': {
      const normalized = normalizeImageBlockValue(value);
      return normalized ?? createImageBlock();
    }
    case 'button':
      return {
        id: typeof value.id === 'string' ? value.id : crypto.randomUUID(),
        type: 'button',
        label: typeof value.label === 'string' ? value.label : 'Button',
        href: typeof value.href === 'string' ? value.href : '#',
        target: value.target === '_blank' ? '_blank' : '_self',
        style: value.style === 'outline' ? 'outline' : 'primary',
        align: value.align === 'center' || value.align === 'right' ? value.align : 'left',
      };
    case 'divider':
      return {
        id: typeof value.id === 'string' ? value.id : crypto.randomUUID(),
        type: 'divider',
      };
    case 'spacer':
      return {
        id: typeof value.id === 'string' ? value.id : crypto.randomUUID(),
        type: 'spacer',
        height: typeof value.height === 'number' ? value.height : 24,
      };
    case 'two-col':
      return normalizeTwoColumnBlock(value);
    case 'heading':
      return normalizeTextBlockValue({ ...value, type: 'text' }, typeof value.text === 'string' ? value.text : '');
    default:
      return null;
  }
};

const normalizeBlocks = (raw: any[]): Block[] => {
  if (!Array.isArray(raw)) {
    return createDefaultBlocks();
  }
  const normalized = raw
    .map((item) => normalizeBlock(item))
    .filter((item): item is Block => Boolean(item));

  return normalized.length ? normalized : createDefaultBlocks();
};

export default function PageBuilderModal({ open, onClose, pageId, restaurantId }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(() => createDefaultBlocks());
  const [selection, setSelection] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [blockLibraryOpen, setBlockLibraryOpen] = useState(false);
  const blockLibraryHostRef = useRef<HTMLDivElement | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [device, setDevice] = useState<DeviceKind>('desktop');
  const history = useRef<Block[][]>([]);
  const future = useRef<Block[][]>([]);
  const lastSavedStateRef = useRef<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [exitModalOpen, setExitModalOpen] = useState(false);

  // Load page JSON
  useEffect(() => {
    if (!open || !pageId) return;
    (async () => {
      const { data, error } = await supabase
        .from('custom_pages')
        .select('content_json')
        .eq('id', pageId)
        .eq('restaurant_id', restaurantId)
        .single();
      if (!error) {
        const parsed = normalizeBlocks(data?.content_json ?? []);
        lastSavedStateRef.current = JSON.stringify(parsed);
        history.current = [];
        future.current = [];
        setBlocks(parsed);
        setIsDirty(false);
      }
    })();
  }, [open, pageId, restaurantId]);

  // lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // undo stack helper
  const pushHistory = useCallback((next: Block[]) => {
    history.current.push(next);
    if (history.current.length > 50) history.current.shift();
    future.current = [];
  }, []);

  function addBlock(kind: BlockCreatorKind) {
    if (kind === 'header') {
      const existingHeader = blocks.find((block) => block.type === 'header');
      if (existingHeader) {
        setSelection(existingHeader.id);
        if (blocks[0]?.id !== existingHeader.id) {
          const reordered = [existingHeader, ...blocks.filter((block) => block.id !== existingHeader.id)];
          pushHistory(blocks);
          setBlocks(reordered);
        }
        return;
      }
      const header = NEW_BLOCKS.header();
      pushHistory(blocks);
      setBlocks([header, ...blocks]);
      setSelection(header.id);
      return;
    }

    const created = NEW_BLOCKS[kind]();
    const next = [...blocks, created];
    pushHistory(blocks);
    setBlocks(next);
    setSelection(created.id);
  }

  function removeBlock(id: string) {
    const next = blocks.filter(b => b.id !== id);
    pushHistory(blocks);
    setBlocks(next);
    if (selection === id) setSelection(null);
  }

  function duplicateBlock(id: string) {
    const index = blocks.findIndex(b => b.id === id);
    if (index < 0) return;
    const clone = cloneBlockWithIds(blocks[index]);
    const next = [...blocks];
    next.splice(index + 1, 0, clone);
    pushHistory(blocks);
    setBlocks(next);
    setSelection(clone.id);
  }

  function moveBlock(id: string, direction: -1|1) {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx < 0) return;
    const targetBlock = blocks[idx];
    if (targetBlock?.type === 'header') return;
    const headerIndex = blocks.findIndex((block) => block.type === 'header');
    const ni = idx + direction;
    if (ni < 0 || ni >= blocks.length) return;
    if (headerIndex >= 0 && headerIndex !== idx && ni <= headerIndex) {
      return;
    }
    const next = [...blocks];
    const [m] = next.splice(idx, 1);
    next.splice(ni, 0, m);
    const updatedHeaderIndex = next.findIndex((block) => block.type === 'header');
    if (updatedHeaderIndex > 0) {
      const [header] = next.splice(updatedHeaderIndex, 1);
      next.unshift(header);
    }
    pushHistory(blocks);
    setBlocks(next);
  }

  function updateBlock(id: string, patch: Partial<any>) {
    const next = blocks.map(b => b.id === id ? { ...b, ...patch } as Block : b);
    pushHistory(blocks);
    setBlocks(next);
  }

  const handleAddBlock = useCallback(() => {
    setBlockLibraryOpen(true);
  }, []);

  const loadDemoPage = useCallback(
    (demo: DemoPage) => {
      const cloned = demo.blocks.map((block) => cloneBlockWithIds(block));
      pushHistory(blocks);
      setBlocks(cloned);
      setSelection(cloned[0]?.id ?? null);
      setDrawerOpen(false);
      setBlockLibraryOpen(false);
    },
    [blocks, pushHistory],
  );

  const toolbarStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'sticky',
      top: 0,
      zIndex: 5,
      background: tokens.colors.surface,
      borderBottom: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
      boxShadow: '0 12px 24px rgba(15, 23, 42, 0.08)',
    }),
    [],
  );

  const deviceOptions: DeviceKind[] = ['mobile', 'tablet', 'desktop'];
  const deviceLabels: Record<DeviceKind, string> = {
    mobile: 'Mobile',
    tablet: 'Tablet',
    desktop: 'Desktop',
  };

  const handleDeviceChange = useCallback((next: DeviceKind) => {
    setDevice((current) => (current === next ? current : next));
  }, []);

  const handleBlocksClick = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setBlockLibraryOpen(true);
      setDrawerOpen(false);
      return;
    }
    setDrawerOpen((prev) => !prev);
    setBlockLibraryOpen(false);
  }, []);

  const handleBlockSelect = (kind: BlockPaletteKind) => {
    addBlock(kind);
    setBlockLibraryOpen(false);
  };

  useEffect(() => {
    if (selection) setInspectorOpen(true);
  }, [selection]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      setDrawerOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setExitModalOpen(false);
    }
  }, [open]);

  useEffect(() => {
    const serialized = JSON.stringify(blocks);
    if (!lastSavedStateRef.current) {
      lastSavedStateRef.current = serialized;
      if (isDirty) setIsDirty(false);
      return;
    }
    const dirty = serialized !== lastSavedStateRef.current;
    if (dirty !== isDirty) {
      setIsDirty(dirty);
    }
  }, [blocks, isDirty]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  const selectedBlock = useMemo(() => blocks.find((b) => b.id === selection) ?? null, [blocks, selection]);
  const inspectorVisible = inspectorOpen;
  const undoDisabled = history.current.length === 0;
  const redoDisabled = future.current.length === 0;

  const inspectorWrapperStyle = useMemo<React.CSSProperties>(
    () => ({
      width: inspectorVisible ? 320 : 0,
      transition: `width 240ms ${tokens.easing.standard}`,
      borderLeft: inspectorVisible ? `${tokens.border.thin}px solid ${tokens.colors.borderLight}` : 'none',
      background: tokens.colors.surface,
      boxShadow: inspectorVisible ? tokens.shadow.sm : 'none',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }),
    [inspectorVisible]
  );

  const drawerStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      width: 288,
      background: tokens.colors.surface,
      borderRight: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
      boxShadow: tokens.shadow.lg,
      padding: tokens.spacing.lg,
      display: 'flex',
      flexDirection: 'column',
      gap: tokens.spacing.lg,
      overflowY: 'auto',
      transform: drawerOpen ? 'translateX(0)' : 'translateX(-110%)',
      transition: `transform 220ms ${tokens.easing.standard}`,
      zIndex: 2,
      borderTopRightRadius: tokens.radius.lg,
      borderBottomRightRadius: tokens.radius.lg,
    }),
    [drawerOpen]
  );

  const drawerOverlayStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.08)',
      opacity: drawerOpen ? 1 : 0,
      pointerEvents: drawerOpen ? 'auto' : 'none',
      transition: `opacity 200ms ${tokens.easing.standard}`,
      zIndex: 1,
    }),
    [drawerOpen]
  );

  function undo() {
    const prev = history.current.pop();
    if (!prev) return;
    future.current.push(blocks);
    setBlocks(prev);
  }
  function redo() {
    const nxt = future.current.pop();
    if (!nxt) return;
    history.current.push(blocks);
    setBlocks(nxt);
  }

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('custom_pages')
        .update({ content_json: blocks })
        .eq('id', pageId)
        .eq('restaurant_id', restaurantId);
      if (error) throw error;
      lastSavedStateRef.current = JSON.stringify(blocks);
      setIsDirty(false);
      alert('Saved');
      return true;
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'Failed to save');
      return false;
    } finally {
      setSaving(false);
    }
  }, [blocks, pageId, restaurantId]);

  const finalizeClose = useCallback(() => {
    setBlockLibraryOpen(false);
    setDrawerOpen(false);
    setInspectorOpen(false);
    setExitModalOpen(false);
    onClose();
  }, [onClose]);

  const handleRequestClose = useCallback(() => {
    if (isDirty) {
      setExitModalOpen(true);
      return;
    }
    finalizeClose();
  }, [finalizeClose, isDirty]);

  const handleSaveAndExit = useCallback(async () => {
    const success = await save();
    if (success) {
      finalizeClose();
    }
  }, [finalizeClose, save]);

  const handleExitWithoutSaving = useCallback(() => {
    finalizeClose();
  }, [finalizeClose]);

  if (!open) return null;

  return (
    <>
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex">
        <div className="absolute inset-0 bg-black/50" onClick={handleRequestClose} />
        <div className="relative z-[61] m-4 flex w-[calc(100%-2rem)] flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="builder-toolbar" style={toolbarStyle}>
            <div className="builder-toolbar__left">
              <button
                type="button"
                onClick={handleBlocksClick}
                className="toolbar-button"
                data-active={drawerOpen || blockLibraryOpen}
                aria-pressed={drawerOpen || blockLibraryOpen}
              >
                Blocks
              </button>
              <button
                type="button"
                onClick={() => setInspectorOpen((prev) => !prev)}
                className="toolbar-button icon-button"
                data-active={inspectorVisible}
                aria-pressed={inspectorVisible}
                title="Inspector"
                aria-label="Toggle inspector"
              >
                <SlidersHorizontal size={18} strokeWidth={2} />
              </button>
            </div>
            <div className="builder-toolbar__center">
              <button
                type="button"
                onClick={undo}
                className="toolbar-button icon-button"
                disabled={undoDisabled}
                title="Undo"
                aria-label="Undo"
              >
                <Undo2 size={18} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={redo}
                className="toolbar-button icon-button"
                disabled={redoDisabled}
                title="Redo"
                aria-label="Redo"
              >
                <Redo2 size={18} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => {
                  void save();
                }}
                disabled={saving}
                className="toolbar-button primary"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleRequestClose}
                className="toolbar-button icon-button"
                title="Close"
                aria-label="Close"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <div className="builder-toolbar__right">
              {deviceOptions.map((value) => {
                const isActive = device === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleDeviceChange(value)}
                    className="toolbar-button device-button"
                    data-active={isActive}
                    aria-pressed={isActive}
                    title={`${deviceLabels[value]} preview`}
                  >
                    {deviceLabels[value]}
                  </button>
                );
              })}
            </div>
          </div>

        <div className="flex flex-1 overflow-hidden" style={{ background: tokens.colors.canvas }}>
          <div className="relative flex flex-1 overflow-hidden">
            <div className="hidden md:block" style={drawerOverlayStyle} onClick={() => setDrawerOpen(false)} />
            <div className="hidden md:flex" style={drawerStyle}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: tokens.spacing.sm,
                }}
              >
                <span
                  style={{
                    fontSize: tokens.fontSize.sm,
                    fontWeight: tokens.fontWeight.semibold,
                    color: tokens.colors.textSecondary,
                    textTransform: 'uppercase',
                  }}
                >
                  Blocks
                </span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  style={{
                    borderRadius: tokens.radius.sm,
                    border: `${tokens.border.thin}px solid transparent`,
                    background: 'transparent',
                    color: tokens.colors.textSecondary,
                    cursor: 'pointer',
                    padding: tokens.spacing.xs,
                  }}
                  aria-label="Close block drawer"
                >
                  ×
                </button>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: tokens.spacing.sm,
                }}
              >
                {BLOCK_LIBRARY.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.kind}
                      type="button"
                      onClick={() => addBlock(option.kind)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: tokens.spacing.sm,
                        borderRadius: tokens.radius.md,
                        border: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
                        background: tokens.colors.surfaceSubtle,
                        padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: `border-color 160ms ${tokens.easing.standard}, background-color 160ms ${tokens.easing.standard}, transform 160ms ${tokens.easing.standard}`,
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: tokens.spacing.lg,
                          height: tokens.spacing.lg,
                          borderRadius: tokens.radius.sm,
                          background: 'rgba(14, 165, 233, 0.12)',
                          color: tokens.colors.accent,
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={18} strokeWidth={1.6} />
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span
                          style={{
                            fontSize: tokens.fontSize.sm,
                            fontWeight: tokens.fontWeight.medium,
                            color: tokens.colors.textSecondary,
                          }}
                        >
                          {option.title}
                        </span>
                        <span
                          style={{
                            fontSize: tokens.fontSize.xs,
                            color: tokens.colors.textMuted,
                            lineHeight: 1.4,
                          }}
                        >
                          {option.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
                <span
                  style={{
                    fontSize: tokens.fontSize.sm,
                    fontWeight: tokens.fontWeight.semibold,
                    color: tokens.colors.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  QA demo pages
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
                  {DEMO_PAGES.map((demo) => (
                    <button
                      key={demo.id}
                      type="button"
                      onClick={() => loadDemoPage(demo)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 4,
                        padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
                        borderRadius: tokens.radius.md,
                        border: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
                        background: tokens.colors.surface,
                        cursor: 'pointer',
                        transition: `border-color 160ms ${tokens.easing.standard}, box-shadow 160ms ${tokens.easing.standard}, transform 160ms ${tokens.easing.standard}`,
                        textAlign: 'left',
                      }}
                    >
                      <span
                        style={{
                          fontSize: tokens.fontSize.sm,
                          fontWeight: tokens.fontWeight.medium,
                          color: tokens.colors.textSecondary,
                        }}
                      >
                        {demo.name}
                      </span>
                      <span
                        style={{
                          fontSize: tokens.fontSize.xs,
                          color: tokens.colors.textMuted,
                          lineHeight: 1.4,
                        }}
                      >
                        {demo.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
            <main
              ref={blockLibraryHostRef}
              className="flex-1 overflow-hidden"
              style={{ position: 'relative' }}
            >
              <WebpageBuilder
                blocks={blocks}
                selectedBlockId={selection}
                onSelectBlock={(id) => setSelection(id)}
                onDeleteBlock={removeBlock}
                onDuplicateBlock={duplicateBlock}
                onMoveBlock={moveBlock}
                onAddBlock={handleAddBlock}
                device={device}
                inspectorVisible={inspectorVisible}
              />
            </main>
          </div>
          <div className="hidden md:flex" style={inspectorWrapperStyle}>
            {inspectorVisible && (
              <div className="flex h-full w-full flex-col">
                <div
                  style={{
                    padding: tokens.spacing.lg,
                    borderBottom: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: tokens.spacing.sm,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span
                      style={{
                        fontSize: tokens.fontSize.sm,
                        fontWeight: tokens.fontWeight.semibold,
                        color: tokens.colors.textSecondary,
                        textTransform: 'uppercase',
                      }}
                    >
                      Inspector
                    </span>
                    <span style={{ fontSize: tokens.fontSize.xs, color: tokens.colors.textMuted }}>
                      {selectedBlock ? `Editing ${selectedBlock.type.replace(/-/g, ' ')}` : 'Select a block to edit'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectorOpen(false)}
                    style={{
                      borderRadius: tokens.radius.sm,
                      border: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
                      background: tokens.colors.surface,
                      color: tokens.colors.textSecondary,
                      padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {!selectedBlock ? (
                    <div className="text-sm text-neutral-500">Select a block to edit its properties.</div>
                  ) : (
                    <Inspector
                      key={selectedBlock.id}
                      block={selectedBlock}
                      onChange={(patch) => updateBlock(selectedBlock.id, patch)}
                      restaurantId={restaurantId}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .builder-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: ${tokens.spacing.sm}px;
          row-gap: ${tokens.spacing.sm}px;
          padding: ${tokens.spacing.md}px ${tokens.spacing.xl}px;
          min-height: 56px;
        }

        .builder-toolbar__left,
        .builder-toolbar__right {
          display: flex;
          align-items: center;
          gap: ${tokens.spacing.sm}px;
          flex: 1 1 auto;
        }

        .builder-toolbar__left {
          justify-content: flex-start;
        }

        .builder-toolbar__center {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: ${tokens.spacing.sm}px;
          flex: 0 0 auto;
        }

        .builder-toolbar__right {
          justify-content: flex-end;
        }

        .toolbar-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: ${tokens.spacing.xs}px;
          padding: ${tokens.spacing.xs}px ${tokens.spacing.md}px;
          border-radius: ${tokens.radius.md}px;
          border: ${tokens.border.thin}px solid ${tokens.colors.borderLight};
          background: ${tokens.colors.surface};
          color: ${tokens.colors.textSecondary};
          font-size: ${tokens.fontSize.sm}px;
          font-weight: ${tokens.fontWeight.medium};
          min-height: 44px;
          cursor: pointer;
          transition: background-color 160ms ${tokens.easing.standard}, border-color 160ms ${tokens.easing.standard}, box-shadow 160ms ${tokens.easing.standard}, color 160ms ${tokens.easing.standard};
        }

        .toolbar-button.icon-button {
          width: 44px;
          min-width: 44px;
          padding: ${tokens.spacing.xs}px;
        }

        .toolbar-button.device-button {
          text-transform: capitalize;
          min-width: 88px;
        }

        .toolbar-button:hover {
          background: ${tokens.colors.surfaceHover};
          border-color: ${tokens.colors.borderStrong};
          box-shadow: ${tokens.shadow.sm};
        }

        .toolbar-button:focus-visible {
          outline: 2px solid ${tokens.colors.focusRing};
          outline-offset: 2px;
        }

        .toolbar-button[disabled] {
          opacity: 0.6;
          cursor: not-allowed;
          box-shadow: none;
        }

        .toolbar-button[data-active='true'],
        .toolbar-button.primary {
          background: ${tokens.colors.accent};
          border-color: ${tokens.colors.accent};
          color: ${tokens.colors.textOnDark};
          box-shadow: 0 12px 24px rgba(14, 165, 233, 0.25);
        }

        .toolbar-button[data-active='true']:hover,
        .toolbar-button.primary:hover {
          background: ${tokens.colors.accentStrong};
          border-color: ${tokens.colors.accentStrong};
        }

        .toolbar-button.destructive {
          color: var(--danger, #ef4444);
          border-color: rgba(239, 68, 68, 0.35);
        }

        .toolbar-button.destructive:hover {
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.45);
          color: var(--danger, #ef4444);
          box-shadow: none;
        }

        @media (max-width: 768px) {
          .builder-toolbar {
            padding: ${tokens.spacing.sm}px ${tokens.spacing.md}px;
          }

          .builder-toolbar__left,
          .builder-toolbar__center,
          .builder-toolbar__right {
            flex: 1 1 100%;
            justify-content: center;
          }

          .builder-toolbar__left {
            justify-content: flex-start;
          }

          .builder-toolbar__right {
            justify-content: center;
          }

          .toolbar-button {
            min-height: 40px;
          }

          .toolbar-button.icon-button {
            width: 40px;
            min-width: 40px;
          }
        }
      `}</style>

      <AddBlockModal
        open={blockLibraryOpen}
        options={BLOCK_LIBRARY}
        onSelect={handleBlockSelect}
        onClose={() => setBlockLibraryOpen(false)}
        containerRef={blockLibraryHostRef}
      />

      {exitModalOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center"
          style={{
            background: 'rgba(15, 23, 42, 0.4)',
            padding: tokens.spacing.lg,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              borderRadius: tokens.radius.lg,
              background: tokens.colors.surface,
              boxShadow: tokens.shadow.lg,
              padding: tokens.spacing.xl,
              display: 'flex',
              flexDirection: 'column',
              gap: tokens.spacing.lg,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
              <h2
                style={{
                  fontSize: tokens.fontSize.xl,
                  fontWeight: tokens.fontWeight.semibold,
                  color: tokens.colors.textPrimary,
                  margin: 0,
                }}
              >
                Unsaved Changes
              </h2>
              <p
                style={{
                  margin: 0,
                  color: tokens.colors.textSecondary,
                  fontSize: tokens.fontSize.sm,
                  lineHeight: tokens.lineHeight.relaxed,
                }}
              >
                You have unsaved changes. Are you sure you want to exit?
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
              <button
                type="button"
                className="toolbar-button primary"
                onClick={() => {
                  void handleSaveAndExit();
                }}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save & Exit'}
              </button>
              <button
                type="button"
                className="toolbar-button destructive"
                onClick={handleExitWithoutSaving}
                disabled={saving}
              >
                Exit Without Saving
              </button>
              <button
                type="button"
                className="toolbar-button"
                onClick={() => setExitModalOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile inspector drawer */}
      {selection && inspectorOpen && (
        <div
          className="md:hidden fixed inset-0 z-[62] flex flex-col bg-white"
          style={{
            padding: tokens.spacing.md,
            gap: tokens.spacing.md,
            height: '100vh',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: tokens.spacing.sm,
              paddingBottom: tokens.spacing.sm,
              borderBottom: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
            }}
          >
            <span
              style={{
                fontWeight: tokens.fontWeight.semibold,
                color: tokens.colors.textSecondary,
              }}
            >
              Inspector
            </span>
            <button
              type="button"
              onClick={() => setInspectorOpen(false)}
              className="toolbar-button"
              style={{ padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px` }}
            >
              Close
            </button>
          </div>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              paddingTop: tokens.spacing.md,
              scrollBehavior: 'smooth',
              paddingBottom: tokens.spacing.md,
            }}
          >
            <Inspector
              key={selection}
              block={blocks.find((b) => b.id === selection)!}
              onChange={(patch) => updateBlock(selection, patch)}
              restaurantId={restaurantId}
            />
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacing.xs,
        marginBottom: tokens.spacing.md,
      }}
    >
      <span
        style={{
          fontSize: tokens.fontSize.xs,
          fontWeight: tokens.fontWeight.medium,
          color: tokens.colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Inspector({
  block,
  onChange,
  restaurantId,
}: {
  block: Block;
  onChange: (patch: Partial<any>) => void;
  restaurantId: string;
}) {
  switch (block.type) {
    case 'header':
      return (
        <HeaderInspector
          block={block}
          onChange={onChange}
          restaurantId={restaurantId}
        />
      );
    case 'text':
      return (
        <div>
          <Field label="Text"><textarea rows={6} className="w-full rounded border px-2 py-1" value={block.text} onChange={e=>onChange({ text: e.target.value })} /></Field>
          <Align value={block.align ?? 'left'} onChange={(align)=>onChange({ align })} />
        </div>
      );
    case 'image':
      return (
        <div>
          <Field label="Image URL"><input className="w-full rounded border px-2 py-1" value={block.src} onChange={e=>onChange({ src: e.target.value })} /></Field>
          <Field label="Alt text"><input className="w-full rounded border px-2 py-1" value={block.alt ?? ''} onChange={e=>onChange({ alt: e.target.value })} /></Field>
          <Field label="Max width (px)"><input type="number" className="w-full rounded border px-2 py-1" value={block.width ?? 1200} onChange={e=>onChange({ width: Number(e.target.value) })} /></Field>
          <Field label="Corner radius">
            <select className="w-full rounded border px-2 py-1" value={block.radius ?? 'lg'} onChange={e=>onChange({ radius: e.target.value })}>
              <option value="none">None</option><option value="lg">Large</option><option value="2xl">2XL</option>
            </select>
          </Field>
        </div>
      );
    case 'button':
      return (
        <div>
          <Field label="Label"><input className="w-full rounded border px-2 py-1" value={block.label} onChange={e=>onChange({ label: e.target.value })} /></Field>
          <Field label="Link (href)"><input className="w-full rounded border px-2 py-1" value={block.href ?? ''} onChange={e=>onChange({ href: e.target.value })} /></Field>
          <Field label="Style">
            <select className="w-full rounded border px-2 py-1" value={block.style ?? 'primary'} onChange={e=>onChange({ style: e.target.value })}>
              <option value="primary">Primary</option><option value="outline">Outline</option>
            </select>
          </Field>
          <Align value={block.align ?? 'left'} onChange={(align)=>onChange({ align })} />
        </div>
      );
    case 'spacer':
      return (
        <div>
          <Field label="Height (px)"><input type="number" className="w-full rounded border px-2 py-1" value={block.height ?? 24} onChange={e=>onChange({ height: Number(e.target.value) })} /></Field>
        </div>
      );
    case 'divider':
      return <div className="text-sm text-neutral-500">No options.</div>;
    case 'two-col':
      return <TwoColumnInspector block={block} onChange={onChange} restaurantId={restaurantId} />;
    default:
      return null;
  }
}

type TwoColumnInspectorProps = {
  block: TwoColumnBlock;
  onChange: (patch: Partial<TwoColumnBlock>) => void;
  restaurantId: string;
};

function TwoColumnInspector({ block, onChange, restaurantId }: TwoColumnInspectorProps) {
  const updateColumn = (key: 'left' | 'right', updater: (column: TwoColumnColumn) => TwoColumnColumn) => {
    const nextColumn = updater(block[key]);
    onChange({ [key]: nextColumn });
  };

  const handleTextChange = (key: 'left' | 'right', text: string) => {
    updateColumn(key, (column) => {
      const current = column.text ?? createTextBlock({ text: '' });
      return { ...column, text: { ...current, text } };
    });
  };

  const handleTextAlign = (key: 'left' | 'right', align: 'left' | 'center' | 'right') => {
    updateColumn(key, (column) => {
      const current = column.text ?? createTextBlock({ text: '' });
      return { ...column, text: { ...current, align } };
    });
  };

  const [uploadingColumn, setUploadingColumn] = useState<null | 'left' | 'right'>(null);

  const createColumnImagePath = (key: 'left' | 'right', fileName: string) => {
    const ext = fileName.split('.').pop() || 'jpg';
    return `webpage-columns/${restaurantId}/${key}-${crypto.randomUUID()}.${ext}`;
  };

  const handleRemoveImage = useCallback(
    (key: 'left' | 'right') => {
      updateColumn(key, (column) => ({
        ...column,
        image: null,
        wrapTextAroundImage: false,
      }));
    },
    [updateColumn],
  );

  const handleImageChange = useCallback(
    (key: 'left' | 'right', patch: Partial<ImageBlock>) => {
      updateColumn(key, (column) => {
        let nextPatch = { ...patch };
        if (typeof nextPatch.src === 'string') {
          const normalized = nextPatch.src.trim();
          if (!normalized.length) {
            return { ...column, image: null, wrapTextAroundImage: false };
          }
          nextPatch = { ...nextPatch, src: normalized };
        }

        const baseImage =
          column.image ??
          createImageBlock({
            src: typeof nextPatch.src === 'string' ? nextPatch.src : 'https://placehold.co/800x600',
            width: 720,
          });

        return { ...column, image: { ...baseImage, ...nextPatch } };
      });
    },
    [updateColumn],
  );

  const handleUpload = useCallback(
    async (key: 'left' | 'right', file: File) => {
      if (!restaurantId) return;
      setUploadingColumn(key);
      try {
        const path = createColumnImagePath(key, file.name);
        const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
          upsert: true,
        });
        if (error) throw error;
        const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        if (data?.publicUrl) {
          handleImageChange(key, { src: data.publicUrl });
        }
      } catch (error) {
        // eslint-disable-next-line no-alert
        alert(`Failed to upload image: ${getUploadErrorMessage(error)}`);
      } finally {
        setUploadingColumn(null);
      }
    },
    [handleImageChange, restaurantId],
  );

  const handleWrapToggle = (key: 'left' | 'right', enabled: boolean) => {
    updateColumn(key, (column) => {
      const image = column.image ?? null;
      const alignment = enabled
        ? column.imageAlignment === 'left' || column.imageAlignment === 'right'
          ? column.imageAlignment
          : 'left'
        : column.imageAlignment ?? 'top';
      return {
        ...column,
        wrapTextAroundImage: Boolean(image) && enabled && (alignment === 'left' || alignment === 'right'),
        imageAlignment: alignment,
        imageSpacing: column.imageSpacing ?? tokens.spacing.md,
      };
    });
  };

  const handleImageAlignment = (
    key: 'left' | 'right',
    alignment: TwoColumnColumn['imageAlignment'],
  ) => {
    updateColumn(key, (column) => ({
      ...column,
      imageAlignment: alignment,
      wrapTextAroundImage:
        column.wrapTextAroundImage && (alignment === 'left' || alignment === 'right') && Boolean(column.image),
    }));
  };

  const handleImageSpacing = (key: 'left' | 'right', value: number) => {
    updateColumn(key, (column) => ({
      ...column,
      imageSpacing: Number.isFinite(value) ? Math.max(0, value) : column.imageSpacing ?? tokens.spacing.md,
    }));
  };

  const renderColumnInspector = (key: 'left' | 'right', label: string) => {
    const column = block[key];
    const textValue = column.text?.text ?? '';
    const textAlign = column.text?.align ?? 'left';
    const image = column.image;

    return (
      <div className="mt-6 border-t pt-4">
        <div className="mb-3 text-xs font-semibold uppercase text-neutral-600">{label}</div>
        <Field label="Text">
          <textarea
            rows={4}
            className="w-full rounded border px-2 py-1"
            value={textValue}
            onChange={(event) => handleTextChange(key, event.target.value)}
          />
        </Field>
        <Align value={textAlign} onChange={(align) => handleTextAlign(key, align)} />
        <div className="mt-4 space-y-3">
          <InputUpload
            label="Column image"
            buttonLabel={image ? 'Replace image' : 'Upload image'}
            accept="image/*"
            uploading={uploadingColumn === key}
            uploadingLabel="Uploading…"
            onSelectFiles={(files) => {
              const file = files?.item(0);
              if (file) {
                void handleUpload(key, file);
              }
            }}
          />
          {image ? (
            <div
              style={{
                border: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
                borderRadius: tokens.radius.md,
                padding: tokens.spacing.sm,
                background: tokens.colors.surface,
              }}
            >
              <img
                src={image.src}
                alt={image.alt ?? ''}
                loading="lazy"
                decoding="async"
                style={{
                  width: '100%',
                  height: 'auto',
                  borderRadius: tokens.radius.sm,
                  display: 'block',
                }}
              />
              <div
                style={{
                  marginTop: tokens.spacing.xs,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: tokens.spacing.sm,
                  fontSize: tokens.fontSize.xs,
                  color: tokens.colors.textMuted,
                }}
              >
                <button
                  type="button"
                  onClick={() => handleRemoveImage(key)}
                  style={{
                    color: '#dc2626',
                    fontWeight: 600,
                  }}
                >
                  Remove image
                </button>
                <a
                  href={image.src}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: tokens.colors.textSecondary, textDecoration: 'underline' }}
                >
                  Open original
                </a>
              </div>
            </div>
          ) : (
            <div
              style={{
                fontSize: tokens.fontSize.xs,
                color: tokens.colors.textMuted,
              }}
            >
              Upload a photo or paste an image URL to feature it in this column.
            </div>
          )}
          <Field label="Image URL">
            <input
              className="w-full rounded border px-2 py-1"
              value={image?.src ?? ''}
              onChange={(event) => handleImageChange(key, { src: event.target.value })}
            />
          </Field>
          <Field label="Alt text">
            <input
              className="w-full rounded border px-2 py-1"
              value={image?.alt ?? ''}
              onChange={(event) => handleImageChange(key, { alt: event.target.value })}
            />
          </Field>
          <Field label="Max width (px)">
            <input
              type="number"
              className="w-full rounded border px-2 py-1"
              value={image?.width ?? 720}
              onChange={(event) => {
                const value = Number(event.target.value);
                handleImageChange(key, { width: Number.isFinite(value) ? value : undefined });
              }}
            />
          </Field>
          <Field label="Corner radius">
            <select
              className="w-full rounded border px-2 py-1"
              value={image?.radius ?? 'lg'}
              onChange={(event) => handleImageChange(key, { radius: event.target.value as ImageBlock['radius'] })}
            >
              <option value="none">None</option>
              <option value="lg">Large</option>
              <option value="2xl">2XL</option>
            </select>
          </Field>
          <Field label="Image position">
            <select
              className="w-full rounded border px-2 py-1"
              value={column.imageAlignment ?? 'top'}
              onChange={(event) =>
                handleImageAlignment(key, event.target.value as TwoColumnColumn['imageAlignment'])
              }
            >
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={Boolean(column.wrapTextAroundImage)}
              disabled={!image}
              onChange={(event) => handleWrapToggle(key, event.target.checked)}
            />
            Wrap text around image
          </label>
          {column.wrapTextAroundImage ? (
            <Field label="Wrap spacing (px)">
              <input
                type="number"
                className="w-full rounded border px-2 py-1"
                value={column.imageSpacing ?? tokens.spacing.md}
                onChange={(event) => handleImageSpacing(key, Number(event.target.value))}
              />
            </Field>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div>
      <Field label="Column ratio">
        <select
          className="w-full rounded border px-2 py-1"
          value={block.ratio ?? '1-1'}
          onChange={(event) => onChange({ ratio: event.target.value as TwoColumnBlock['ratio'] })}
        >
          <option value="1-1">50 / 50</option>
          <option value="1-2">33 / 67</option>
          <option value="2-1">67 / 33</option>
        </select>
      </Field>
      <Field label="Column gap (px)">
        <input
          type="number"
          className="w-full rounded border px-2 py-1"
          value={block.gap ?? tokens.spacing.lg}
          onChange={(event) => {
            const value = Number(event.target.value);
            onChange({ gap: Number.isFinite(value) ? value : block.gap ?? tokens.spacing.lg });
          }}
        />
      </Field>
      <Field label="Padding (px)">
        <input
          type="number"
          className="w-full rounded border px-2 py-1"
          value={block.padding ?? tokens.spacing.lg}
          onChange={(event) => {
            const value = Number(event.target.value);
            onChange({ padding: Number.isFinite(value) ? value : block.padding ?? tokens.spacing.lg });
          }}
        />
      </Field>
      {renderColumnInspector('left', 'Left column')}
      {renderColumnInspector('right', 'Right column')}
      <div className="mt-4 text-xs text-neutral-500">
        Tip: enable wrapping to let paragraphs flow naturally around imagery for editorial-style layouts.
      </div>
    </div>
  );
}

function Align({ value, onChange }: { value: 'left' | 'center' | 'right'; onChange: (v: any) => void }) {
  const alignments: ReadonlyArray<'left' | 'center' | 'right'> = ['left', 'center', 'right'];
  return (
    <Field label="Alignment">
      <div
        style={{
          display: 'flex',
          gap: tokens.spacing.sm,
        }}
      >
        {alignments.map((alignment) => {
          const isActive = value === alignment;
          return (
            <button
              key={alignment}
              type="button"
              className="align-toggle"
              data-active={isActive}
              onClick={() => onChange(alignment)}
              style={{
                padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
                borderRadius: tokens.radius.sm,
                border: `${tokens.border.thin}px solid ${
                  isActive ? tokens.colors.accent : tokens.colors.borderLight
                }`,
                background: isActive ? 'rgba(14, 165, 233, 0.12)' : tokens.colors.surface,
                color: isActive ? tokens.colors.accent : tokens.colors.textSecondary,
                fontSize: tokens.fontSize.xs,
                fontWeight: tokens.fontWeight.medium,
                textTransform: 'capitalize',
                transition: `background-color 160ms ${tokens.easing.standard}, border-color 160ms ${tokens.easing.standard}, color 160ms ${tokens.easing.standard}`,
                cursor: 'pointer',
              }}
            >
              {alignment}
            </button>
          );
        })}
      </div>
      <style jsx>{`
        .align-toggle:not([data-active='true']):hover {
          background: ${tokens.colors.surfaceHover};
          border-color: ${tokens.colors.borderStrong};
        }

        .align-toggle:focus-visible {
          outline: 2px solid ${tokens.colors.focusRing};
          outline-offset: 2px;
        }
      `}</style>
    </Field>
  );
}

