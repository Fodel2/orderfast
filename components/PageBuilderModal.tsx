import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Columns,
  Image as ImageIcon,
  LayoutDashboard,
  Minus,
  MoveVertical,
  Redo2,
  Type,
  Undo2,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  Block,
  HeaderBlock,
  ImageBlock,
  TextAnimationType,
  TextBlock,
  TwoColumnBlock,
  TwoColumnColumn,
} from './PageRenderer';
import WebpageBuilder from './webpage/WebpageBuilder';
import HeaderInspector from './webpage/HeaderInspector';
import TextInspector from './webpage/TextInspector';
import InspectorPanel from './inspector/InspectorPanel';
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
  headerHeight: 80,
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

const ensureNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const ensureString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const ensureBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const clampWithin = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const TEXT_BACKGROUND_MODES = new Set(['none', 'color', 'gradient', 'image']);

const TEXT_ANIMATION_TYPES: TextAnimationType[] = [
  'none',
  'fade-in',
  'slide-in-left',
  'slide-in-right',
  'slide-in-up',
  'slide-in-down',
  'zoom-in',
];

const sanitizeTextTypography = (value: any): TextBlock['typography'] | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const typography: NonNullable<TextBlock['typography']> = {};

  const fontFamily = ensureString(value.fontFamily);
  if (fontFamily) {
    typography.fontFamily = fontFamily;
  }

  const fontWeight = ensureNumber(value.fontWeight);
  if (fontWeight !== undefined) {
    typography.fontWeight = fontWeight;
  }

  const fontSize = ensureNumber(value.fontSize);
  if (fontSize !== undefined) {
    typography.fontSize = fontSize;
  }

  const lineHeight = ensureNumber(value.lineHeight);
  if (lineHeight !== undefined) {
    typography.lineHeight = lineHeight;
  }

  const letterSpacing = ensureNumber(value.letterSpacing);
  if (letterSpacing !== undefined) {
    typography.letterSpacing = letterSpacing;
  }

  const color = ensureString(value.color);
  if (color && color.trim().length > 0) {
    typography.color = color;
  }

  const opacity = ensureNumber(value.opacity);
  if (opacity !== undefined) {
    typography.opacity = opacity;
  }

  const bold = ensureBoolean(value.bold);
  if (bold !== undefined) {
    typography.bold = bold;
  }

  const italic = ensureBoolean(value.italic);
  if (italic !== undefined) {
    typography.italic = italic;
  }

  const underline = ensureBoolean(value.underline);
  if (underline !== undefined) {
    typography.underline = underline;
  }

  const uppercase = ensureBoolean(value.uppercase);
  if (uppercase !== undefined) {
    typography.uppercase = uppercase;
  }

  return Object.keys(typography).length > 0 ? typography : undefined;
};

const sanitizeTextBackground = (value: any): TextBlock['background'] | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const background: NonNullable<TextBlock['background']> = {};

  const modeCandidate = ensureString(value.mode);
  if (modeCandidate && TEXT_BACKGROUND_MODES.has(modeCandidate)) {
    background.mode = modeCandidate as NonNullable<TextBlock['background']>['mode'];
  }

  const color = ensureString(value.color);
  if (color && color.trim().length > 0) {
    background.color = color;
  }

  if (value.gradient && typeof value.gradient === 'object') {
    const gradient: NonNullable<NonNullable<TextBlock['background']>['gradient']> = {};
    const start = ensureString(value.gradient.start);
    if (start && start.trim().length > 0) {
      gradient.start = start;
    }
    const end = ensureString(value.gradient.end);
    if (end && end.trim().length > 0) {
      gradient.end = end;
    }
    const angle = ensureNumber(value.gradient.angle);
    if (angle !== undefined) {
      gradient.angle = angle;
    }
    if (Object.keys(gradient).length > 0) {
      background.gradient = gradient;
    }
  }

  if (value.imageUrl === null) {
    background.imageUrl = null;
  } else {
    const imageUrl = ensureString(value.imageUrl);
    if (imageUrl) {
      background.imageUrl = imageUrl;
    }
  }

  const imageFitCandidate = ensureString(value.imageFit);
  if (imageFitCandidate === 'cover' || imageFitCandidate === 'contain') {
    background.imageFit = imageFitCandidate;
  }

  const imagePositionCandidate = ensureString(value.imagePosition);
  if (imagePositionCandidate && ['left', 'center', 'right'].includes(imagePositionCandidate)) {
    background.imagePosition = imagePositionCandidate as 'left' | 'center' | 'right';
  }

  const focalX = ensureNumber(value.focalX);
  if (focalX !== undefined) {
    background.focalX = clampWithin(focalX, 0, 100);
  }

  const focalY = ensureNumber(value.focalY);
  if (focalY !== undefined) {
    background.focalY = clampWithin(focalY, 0, 100);
  }

  const imageOpacity = ensureNumber(value.imageOpacity);
  if (imageOpacity !== undefined) {
    background.imageOpacity = imageOpacity;
  }

  const blur = ensureNumber(value.blur);
  if (blur !== undefined) {
    background.blur = blur;
  }

  return Object.keys(background).length > 0 ? background : undefined;
};

const sanitizeTextSpacing = (value: any): TextBlock['spacing'] | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const spacing: NonNullable<TextBlock['spacing']> = {};

  const marginTop = ensureNumber(value.marginTop);
  if (marginTop !== undefined) {
    spacing.marginTop = marginTop;
  }

  const marginRight = ensureNumber(value.marginRight);
  if (marginRight !== undefined) {
    spacing.marginRight = marginRight;
  }

  const marginBottom = ensureNumber(value.marginBottom);
  if (marginBottom !== undefined) {
    spacing.marginBottom = marginBottom;
  }

  const marginLeft = ensureNumber(value.marginLeft);
  if (marginLeft !== undefined) {
    spacing.marginLeft = marginLeft;
  }

  const paddingTop = ensureNumber(value.paddingTop);
  if (paddingTop !== undefined) {
    spacing.paddingTop = paddingTop;
  }

  const paddingRight = ensureNumber(value.paddingRight);
  if (paddingRight !== undefined) {
    spacing.paddingRight = paddingRight;
  }

  const paddingBottom = ensureNumber(value.paddingBottom);
  if (paddingBottom !== undefined) {
    spacing.paddingBottom = paddingBottom;
  }

  const paddingLeft = ensureNumber(value.paddingLeft);
  if (paddingLeft !== undefined) {
    spacing.paddingLeft = paddingLeft;
  }

  return Object.keys(spacing).length > 0 ? spacing : undefined;
};

const sanitizeTextOverlay = (value: any): TextBlock['overlay'] | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const overlay: NonNullable<TextBlock['overlay']> = {};

  const color = ensureString(value.color);
  if (color && color.trim().length > 0) {
    overlay.color = color;
  }

  const opacity = ensureNumber(value.opacity);
  if (opacity !== undefined) {
    overlay.opacity = opacity;
  }

  return Object.keys(overlay).length > 0 ? overlay : undefined;
};

const sanitizeTextAnimation = (value: any): TextBlock['animation'] | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const animation: NonNullable<TextBlock['animation']> = {};

  const enabled = ensureBoolean(value.enabled);
  if (enabled !== undefined) {
    animation.enabled = enabled;
  }

  const typeCandidate = ensureString(value.type);
  if (typeCandidate && TEXT_ANIMATION_TYPES.includes(typeCandidate as TextAnimationType)) {
    animation.type = typeCandidate as TextAnimationType;
  }

  const duration = ensureNumber(value.duration);
  if (duration !== undefined) {
    animation.duration = duration;
  }

  const delay = ensureNumber(value.delay);
  if (delay !== undefined) {
    animation.delay = delay;
  }

  return Object.keys(animation).length > 0 ? animation : undefined;
};

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
    const typography = sanitizeTextTypography(value.typography);
    const background = sanitizeTextBackground(value.background);
    const spacing = sanitizeTextSpacing(value.spacing);
    const overlay = sanitizeTextOverlay(value.overlay);
    const animation = sanitizeTextAnimation(value.animation);

    const block: TextBlock = {
      id: typeof value.id === 'string' ? value.id : crypto.randomUUID(),
      type: 'text',
      text: typeof value.text === 'string' ? value.text : fallbackText,
      align,
    };

    if (typography) {
      block.typography = typography;
    }

    if (background) {
      block.background = background;
    }

    if (spacing) {
      block.spacing = spacing;
    }

    if (overlay) {
      block.overlay = overlay;
    }

    if (animation) {
      block.animation = animation;
    }

    return block;
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
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 900;
  const history = useRef<Block[][]>([]);
  const future = useRef<Block[][]>([]);

  const selectBlock = useCallback((id: string | null) => {
    setSelection(id);
    setInspectorOpen(Boolean(id));
  }, []);

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
        setBlocks(parsed);
      }
    })();
  }, [open, pageId, restaurantId]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow || '';
    };
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
        selectBlock(existingHeader.id);
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
      selectBlock(header.id);
      return;
    }

    const created = NEW_BLOCKS[kind]();
    const next = [...blocks, created];
    pushHistory(blocks);
    setBlocks(next);
    selectBlock(created.id);
  }

  function removeBlock(id: string) {
    const next = blocks.filter(b => b.id !== id);
    pushHistory(blocks);
    setBlocks(next);
    if (selection === id) selectBlock(null);
  }

  function duplicateBlock(id: string) {
    const index = blocks.findIndex(b => b.id === id);
    if (index < 0) return;
    const clone = cloneBlockWithIds(blocks[index]);
    const next = [...blocks];
    next.splice(index + 1, 0, clone);
    pushHistory(blocks);
    setBlocks(next);
    selectBlock(clone.id);
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

  const handleBlockSelect = (kind: BlockPaletteKind) => {
    addBlock(kind);
    setBlockLibraryOpen(false);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      setDrawerOpen(true);
    }
  }, []);

  const selectedBlock = useMemo(() => blocks.find((b) => b.id === selection) ?? null, [blocks, selection]);
  const inspectorVisible = inspectorOpen;
  const inspectorSubtitle = useMemo(
    () =>
      selectedBlock
        ? `Editing ${selectedBlock.type.replace(/-/g, ' ')}`
        : 'Select a block to edit',
    [selectedBlock],
  );
  const inspectorContent = useMemo(
    () =>
      selectedBlock ? (
        <Inspector
          key={selectedBlock.id}
          block={selectedBlock}
          onChange={(patch) => updateBlock(selectedBlock.id, patch)}
          restaurantId={restaurantId}
        />
      ) : null,
    [selectedBlock, restaurantId, updateBlock],
  );
  const inspectorEmptyState = useMemo(
    () => (
      <div className="text-sm text-neutral-500">Select a block to edit its properties.</div>
    ),
    [],
  );
  const inspectorShouldOpen = Boolean(inspectorVisible && selectedBlock);

  const drawerPanelStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'fixed',
      left: 0,
      top: 44,
      bottom: 0,
      width: 320,
      zIndex: 60,
      background: tokens.colors.surface,
      borderRight: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
      boxShadow: tokens.shadow.lg,
      padding: tokens.spacing.lg,
      display: 'flex',
      flexDirection: 'column',
      gap: tokens.spacing.md,
      overflowY: 'auto',
      transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
      transition: `transform 200ms ${tokens.easing.standard}`,
    }),
    [drawerOpen]
  );

  const drawerOverlayStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'fixed',
      inset: '44px 0 0 0',
      background: 'rgba(0, 0, 0, 0.25)',
      opacity: drawerOpen ? 1 : 0,
      pointerEvents: drawerOpen ? 'auto' : 'none',
      transition: `opacity 200ms ${tokens.easing.standard}`,
      zIndex: 59,
    }),
    [drawerOpen]
  );

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [drawerOpen]);

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

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('custom_pages')
        .update({ content_json: blocks })
        .eq('id', pageId)
        .eq('restaurant_id', restaurantId);
      if (error) throw error;
      alert('Saved');
    } catch (e:any) {
      console.error(e);
      alert(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-[61] m-4 flex w-[calc(100%-2rem)] flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="wb-toolbar flex items-center">
          <button
            type="button"
            onClick={() => {
              if (isMobile) {
                setBlockLibraryOpen(true);
              } else {
                setDrawerOpen((prev) => !prev);
              }
            }}
            className={`blocks-btn text-sm font-medium ${!isMobile && drawerOpen ? 'ring-1 ring-emerald-500 ring-offset-1 text-emerald-700' : ''}`}
            aria-pressed={isMobile ? blockLibraryOpen : drawerOpen}
          >
            Blocks
          </button>
          <button type="button" onClick={undo} aria-label="Undo" className="icon-btn">
            <Undo2 className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={redo} aria-label="Redo" className="icon-btn">
            <Redo2 className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="save-btn ml-auto text-sm font-medium"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={onClose} aria-label="Close builder" className="icon-btn">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-1" style={{ background: tokens.colors.canvas }}>
          <div className="relative flex flex-1">
            <div className="hidden md:block" style={drawerOverlayStyle} onClick={() => setDrawerOpen(false)} />
            <div className="hidden md:flex" style={drawerPanelStyle}>
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
            </div>
            <main
              ref={blockLibraryHostRef}
              className="flex-1"
              style={{
                position: 'relative',
                zIndex: 30,
                paddingRight: !isMobile && inspectorShouldOpen ? 380 : undefined,
                transition: 'padding 200ms ease',
              }}
            >
              <WebpageBuilder
                blocks={blocks}
                selectedBlockId={selection}
                onSelectBlock={(id) => selectBlock(id)}
                onDeleteBlock={removeBlock}
                onDuplicateBlock={duplicateBlock}
                onMoveBlock={moveBlock}
                onAddBlock={handleAddBlock}
                inspectorVisible={inspectorVisible}
              />
            </main>
            <InspectorPanel
              open={inspectorShouldOpen}
              title="Inspector"
              subtitle={inspectorSubtitle}
              onClose={() => setInspectorOpen(false)}
            >
              {selectedBlock ? inspectorContent : inspectorEmptyState}
            </InspectorPanel>
          </div>
        </div>
      </div>

      <AddBlockModal
        open={blockLibraryOpen}
        options={BLOCK_LIBRARY}
        onSelect={handleBlockSelect}
        onClose={() => setBlockLibraryOpen(false)}
        containerRef={blockLibraryHostRef}
      />

      <style jsx global>{`
        .wb-toolbar {
          gap: 8px;
          height: 44px;
          padding: 0 12px;
          background: var(--surface-1);
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        }
        .wb-toolbar button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--surface-1);
          transition: background 0.2s ease;
          border: none;
          cursor: pointer;
        }
        .wb-toolbar button:hover {
          background: var(--surface-hover);
        }
        .wb-toolbar button:focus-visible {
          outline: 2px solid var(--brand-primary);
          outline-offset: 2px;
        }
        .wb-toolbar .blocks-btn {
          width: auto;
          padding: 0 12px;
          font-weight: 600;
          height: 32px;
        }
        .wb-toolbar .blocks-btn[aria-pressed='true'] {
          background: var(--surface-hover);
          color: var(--brand-primary);
        }
        .wb-toolbar .icon-btn {
          padding: 0;
        }
        .wb-toolbar .save-btn {
          width: auto;
          padding: 0 10px;
          height: 32px;
          font-size: 13px;
          background: var(--brand-primary);
          color: white;
          font-weight: 600;
        }
        .wb-toolbar .save-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .builder-header {
          position: relative;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px clamp(16px, 4vw, 32px);
          min-height: 64px;
        }
        .builder-header .device-controls {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .builder-header .zoom-controls {
          position: absolute;
          top: 12px;
          right: clamp(16px, 4vw, 32px);
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .builder-header .zoom-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 9999px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: var(--surface-1);
          color: rgba(15, 23, 42, 0.75);
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
        }
        .builder-header .zoom-btn:hover:not(:disabled) {
          background: var(--surface-hover);
        }
        .builder-header .zoom-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .builder-header .zoom-readout {
          min-width: 44px;
          text-align: center;
          font-size: 12px;
          font-variant-numeric: tabular-nums;
          color: rgba(15, 23, 42, 0.7);
        }
        .builder-scroll {
          background: var(--surface-muted, #f1f5f9);
        }
        .builder-preview {
          display: flex;
          justify-content: center;
          align-items: flex-start;
          min-height: calc(100vh - 120px);
          padding: 40px clamp(16px, 5vw, 64px);
        }
        .preview-shell {
          width: 100%;
        }
        .preview-scale {
          display: flex;
          justify-content: center;
        }
        .preview-inner {
          width: 100%;
          max-width: 1280px;
        }
        .preview-inner[data-device='tablet'] {
          max-width: 768px;
        }
        .preview-inner[data-device='mobile'] {
          max-width: 420px;
        }
        @media (max-width: 1024px) {
          .builder-header {
            min-height: 60px;
            padding: 12px clamp(12px, 5vw, 24px);
          }
          .builder-preview {
            padding: 32px clamp(12px, 5vw, 40px);
          }
        }
        @media (max-width: 768px) {
          .builder-header {
            min-height: 56px;
          }
          .builder-header .zoom-controls {
            top: 10px;
            right: clamp(12px, 6vw, 20px);
          }
          .builder-preview {
            padding: 24px clamp(12px, 6vw, 24px);
            min-height: calc(100vh - 120px);
          }
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <div className="text-xs font-medium mb-1 text-neutral-600">{label}</div>
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
        <TextInspector
          block={block}
          onChange={onChange}
          restaurantId={restaurantId}
        />
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

function Align({ value, onChange }: { value: 'left'|'center'|'right'; onChange: (v:any)=>void }) {
  return (
    <Field label="Alignment">
      <div className="flex gap-2">
        {(['left','center','right'] as const).map(a => (
          <button key={a} onClick={()=>onChange(a)} className={`px-2 py-1 rounded border ${value===a?'bg-emerald-50 border-emerald-600':''}`}>{a}</button>
        ))}
      </div>
    </Field>
  );
}

