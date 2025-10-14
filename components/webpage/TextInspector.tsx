import React, { useCallback, useMemo, useState } from 'react';

import FontSelect from '@/components/ui/FontSelect';
import { STORAGE_BUCKET } from '@/lib/storage';
import { normalizeFontFamily } from '@/lib/slideFonts';
import { supabase } from '@/lib/supabaseClient';
import InspectorSection, {
  InspectorContainer,
  InspectorGroup,
} from '@/src/components/inspector/InspectorSection';
import ControlRow from '@/src/components/inspector/ControlRow';
import InputColor from '@/src/components/inspector/controls/InputColor';
import InputSelect from '@/src/components/inspector/controls/InputSelect';
import InputSlider from '@/src/components/inspector/controls/InputSlider';
import InputText from '@/src/components/inspector/controls/InputText';
import InputTextArea from '@/src/components/inspector/controls/InputTextArea';
import InputToggle from '@/src/components/inspector/controls/InputToggle';
import InputUpload from '@/src/components/inspector/controls/InputUpload';
import { tokens } from '@/src/ui/tokens';

import type { TextAnimationType, TextBlock } from '../PageRenderer';

const ALIGN_OPTIONS = [
  { label: 'Left', value: 'left' as const },
  { label: 'Center', value: 'center' as const },
  { label: 'Right', value: 'right' as const },
];

const FONT_WEIGHT_OPTIONS = [
  { label: 'Regular (400)', value: '400' },
  { label: 'Medium (500)', value: '500' },
  { label: 'Semibold (600)', value: '600' },
  { label: 'Bold (700)', value: '700' },
  { label: 'Extra Bold (800)', value: '800' },
];

const BACKGROUND_MODE_OPTIONS = [
  { label: 'None', value: 'none' },
  { label: 'Solid color', value: 'color' },
  { label: 'Gradient', value: 'gradient' },
  { label: 'Image', value: 'image' },
];

const IMAGE_FIT_OPTIONS = [
  { label: 'Cover', value: 'cover' },
  { label: 'Contain', value: 'contain' },
];

const IMAGE_POSITION_OPTIONS = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
];

const ANIMATION_OPTIONS: { label: string; value: TextAnimationType }[] = [
  { label: 'Fade in', value: 'fade-in' },
  { label: 'Slide in (left)', value: 'slide-in-left' },
  { label: 'Slide in (right)', value: 'slide-in-right' },
  { label: 'Slide in (up)', value: 'slide-in-up' },
  { label: 'Slide in (down)', value: 'slide-in-down' },
  { label: 'Zoom in', value: 'zoom-in' },
];

const CLEAR_BUTTON_STYLE: React.CSSProperties = {
  alignSelf: 'flex-start',
  borderRadius: tokens.radius.sm,
  border: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
  background: tokens.colors.surface,
  color: tokens.colors.textSecondary,
  padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
  fontSize: '0.75rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const gradientDefaults = {
  angle: 180,
  start: '#0f172a',
  end: '#1e293b',
};

const extractHexFallback = (token: string, fallback: string): string => {
  const match = token.match(/#([0-9a-fA-F]{3,8})/);
  if (!match) {
    return fallback;
  }
  const [raw] = match;
  if (!raw) {
    return fallback;
  }
  const hex = raw.replace('#', '');
  if (hex.length === 3) {
    return `#${hex
      .split('')
      .map((value) => value + value)
      .join('')}`;
  }
  if (hex.length === 8) {
    return `#${hex.slice(0, 6)}`;
  }
  if (hex.length === 6) {
    return `#${hex}`;
  }
  return fallback;
};

const mergeNested = <T extends Record<string, unknown>>(
  current: T | undefined,
  patch: Partial<T>,
): T | undefined => {
  const next: Record<string, unknown> = { ...(current ?? {}) };
  Object.entries(patch).forEach(([key, value]) => {
    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value as unknown;
    }
  });
  return Object.keys(next).length > 0 ? (next as T) : undefined;
};

const createStoragePath = (restaurantId: string, fileName: string) => {
  const ext = fileName.split('.').pop() || 'jpg';
  return `webpage-text-backgrounds/${restaurantId}/${crypto.randomUUID()}.${ext}`;
};

const getErrorMessage = (error: unknown) => {
  if (!error) return 'Unknown error';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in (error as Record<string, unknown>)) {
    return String((error as Record<string, unknown>).message);
  }
  return String(error);
};

const AlignmentControl: React.FC<{
  value: 'left' | 'center' | 'right';
  onChange: (value: 'left' | 'center' | 'right') => void;
}> = ({ value, onChange }) => (
  <ControlRow label="Alignment">
    <div className="alignment-toggle">
      {ALIGN_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`alignment-button${value === option.value ? ' is-active' : ''}`}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>

    <style jsx>{`
      .alignment-toggle {
        display: inline-flex;
        gap: ${tokens.spacing.xs}px;
      }

      .alignment-button {
        padding: ${tokens.spacing.xs}px ${tokens.spacing.sm}px;
        border-radius: ${tokens.radius.sm}px;
        border: ${tokens.border.thin}px solid ${tokens.colors.borderLight};
        background: ${tokens.colors.surface};
        color: ${tokens.colors.textSecondary};
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: capitalize;
        cursor: pointer;
        transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
      }

      .alignment-button:hover {
        background: ${tokens.colors.surfaceMuted};
        border-color: ${tokens.colors.borderStrong};
      }

      .alignment-button.is-active {
        background: ${tokens.colors.accent};
        border-color: ${tokens.colors.accent};
        color: ${tokens.colors.textOnDark};
      }
    `}</style>
  </ControlRow>
);

const QuickStyleToggle: React.FC<{
  label: string;
  active: boolean;
  onToggle: () => void;
}> = ({ label, active, onToggle }) => (
  <button
    type="button"
    className={`quick-style${active ? ' is-active' : ''}`}
    onClick={onToggle}
    aria-pressed={active}
  >
    {label}

    <style jsx>{`
      .quick-style {
        padding: ${tokens.spacing.xs}px ${tokens.spacing.sm}px;
        border-radius: ${tokens.radius.sm}px;
        border: ${tokens.border.thin}px solid ${tokens.colors.borderLight};
        background: ${tokens.colors.surface};
        color: ${tokens.colors.textSecondary};
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: capitalize;
        cursor: pointer;
        transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
      }

      .quick-style:hover {
        background: ${tokens.colors.surfaceMuted};
        border-color: ${tokens.colors.borderStrong};
      }

      .quick-style.is-active {
        background: ${tokens.colors.accent};
        border-color: ${tokens.colors.accent};
        color: ${tokens.colors.textOnDark};
      }
    `}</style>
  </button>
);

type TextInspectorProps = {
  block: TextBlock;
  onChange: (patch: Partial<TextBlock>) => void;
  restaurantId: string;
};

const TextInspector: React.FC<TextInspectorProps> = ({ block, onChange, restaurantId }) => {
  const [uploading, setUploading] = useState(false);

  const typography = block.typography ?? {};
  const background = block.background ?? { mode: 'none' };
  const spacing = block.spacing ?? {};
  const overlay = block.overlay ?? {};
  const animation = block.animation ?? {};

  const fontValue = useMemo(() => normalizeFontFamily(typography.fontFamily) ?? 'default', [typography.fontFamily]);
  const backgroundMode = background.mode ?? 'none';
  const gradientSettings = background.gradient ?? gradientDefaults;
  const hasBackgroundImage = backgroundMode === 'image' && Boolean(background.imageUrl);
  const overlayActive = backgroundMode === 'gradient' || hasBackgroundImage;
  const overlayColorValue = overlay.color ?? '#0f172a';
  const backgroundColorValue = background.color ?? extractHexFallback(tokens.colors.surface, '#ffffff');

  const updateTypography = (patch: Partial<NonNullable<TextBlock['typography']>>) => {
    const next = mergeNested(block.typography, patch);
    onChange({ typography: next });
  };

  const updateBackground = (patch: Partial<NonNullable<TextBlock['background']>>) => {
    const next = mergeNested(block.background, patch);
    onChange({ background: next });
  };

  const updateSpacing = (patch: Partial<NonNullable<TextBlock['spacing']>>) => {
    const next = mergeNested(block.spacing, patch);
    onChange({ spacing: next });
  };

  const updateOverlay = (patch: Partial<NonNullable<TextBlock['overlay']>>) => {
    const next = mergeNested(block.overlay, patch);
    onChange({ overlay: next });
  };

  const updateAnimation = (patch: Partial<NonNullable<TextBlock['animation']>>) => {
    const next = mergeNested(block.animation, patch);
    onChange({ animation: next });
  };

  const handleBackgroundModeChange = (mode: NonNullable<TextBlock['background']>['mode']) => {
    let next = mergeNested(block.background, { mode });
    if (!next) {
      next = { mode } as NonNullable<TextBlock['background']>;
    }
    if (mode !== 'gradient') {
      next = mergeNested(next, { gradient: undefined });
    }
    if (mode !== 'color') {
      next = mergeNested(next, { color: undefined });
    }
    if (mode !== 'image') {
      next = mergeNested(next, {
        imageUrl: undefined,
        imageFit: undefined,
        imagePosition: undefined,
        focalX: undefined,
        focalY: undefined,
        imageOpacity: undefined,
        blur: undefined,
      });
      onChange({ overlay: undefined });
    }
    onChange({ background: next });
  };

  const handleSpacingChange = (key: keyof NonNullable<TextBlock['spacing']>, value: number | undefined) => {
    updateSpacing({ [key]: value } as Partial<NonNullable<TextBlock['spacing']>>);
  };

  const handleUpload = useCallback(
    async (file: File) => {
      if (!restaurantId) return;
      setUploading(true);
      try {
        const path = createStoragePath(restaurantId, file.name);
        const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true });
        if (error) {
          throw error;
        }
        const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        if (data?.publicUrl) {
          const next = mergeNested(block.background, {
            mode: 'image',
            imageUrl: data.publicUrl,
          });
          onChange({ background: next ?? { mode: 'image', imageUrl: data.publicUrl } });
        }
      } catch (error) {
        // eslint-disable-next-line no-alert
        alert(`Failed to upload background image: ${getErrorMessage(error)}`);
      } finally {
        setUploading(false);
      }
    },
    [block.background, onChange, restaurantId],
  );

  const handleAnimationToggle = (enabled: boolean) => {
    if (!enabled) {
      updateAnimation({ enabled: false });
      return;
    }
    updateAnimation({
      enabled: true,
      type:
        block.animation?.type && block.animation.type !== 'none'
          ? block.animation.type
          : 'fade-in',
      duration: block.animation?.duration ?? 300,
      delay: block.animation?.delay ?? 0,
    });
  };

  const handleRemoveBackgroundImage = () => {
    const next = mergeNested(block.background, {
      imageUrl: undefined,
      mode: backgroundMode === 'image' ? 'none' : backgroundMode,
    });
    onChange({ background: next, overlay: undefined });
  };

  const textOpacity = typography.opacity ?? 100;
  const overlayOpacity = overlay.opacity ?? 0;
  const imageOpacity = background.imageOpacity ?? 100;
  const imageBlur = background.blur ?? 0;
  const focalX = background.focalX ?? 50;
  const focalY = background.focalY ?? 50;

  return (
    <InspectorContainer>
      {/* Basic content editing stays front and center for quick copy tweaks. */}
      <InspectorGroup title="Basic">
        <InspectorSection title="Content">
          <InputTextArea
            label="Text"
            value={block.text}
            rows={6}
            onChange={(value) => onChange({ text: value })}
          />
          <AlignmentControl value={block.align ?? 'left'} onChange={(value) => onChange({ align: value })} />
        </InspectorSection>

        {/* Core typography presets mirror slide builder quick settings. */}
        <InspectorSection title="Typography">
          <ControlRow label="Font family">
            <FontSelect
              value={fontValue}
              onChange={(value) =>
                updateTypography({ fontFamily: normalizeFontFamily(value) ?? 'default' })
              }
            />
          </ControlRow>
          <InputSelect
            label="Font weight"
            value={String(typography.fontWeight ?? 400)}
            onChange={(value) => updateTypography({ fontWeight: Number.parseInt(value, 10) || 400 })}
            options={FONT_WEIGHT_OPTIONS}
          />
          <InputSlider
            label="Font size (px)"
            value={typography.fontSize}
            fallbackValue={tokens.fontSize.md}
            min={12}
            max={72}
            step={1}
            onChange={(value) => updateTypography({ fontSize: value })}
          />
          <InputColor
            label="Text color"
            value={typography.color ?? tokens.colors.textSecondary}
            onChange={(value) => updateTypography({ color: value })}
          />
          <InputSlider
            label="Text opacity (%)"
            value={textOpacity}
            fallbackValue={100}
            min={0}
            max={100}
            onChange={(value) => updateTypography({ opacity: value })}
          />
          <ControlRow label="Quick styles">
            <div className="quick-style-group">
              <QuickStyleToggle
                label="bold"
                active={Boolean(typography.bold)}
                onToggle={() => updateTypography({ bold: !typography.bold })}
              />
              <QuickStyleToggle
                label="italic"
                active={Boolean(typography.italic)}
                onToggle={() => updateTypography({ italic: !typography.italic })}
              />
              <QuickStyleToggle
                label="underline"
                active={Boolean(typography.underline)}
                onToggle={() => updateTypography({ underline: !typography.underline })}
              />
              <QuickStyleToggle
                label="uppercase"
                active={Boolean(typography.uppercase)}
                onToggle={() => updateTypography({ uppercase: !typography.uppercase })}
              />
            </div>
          </ControlRow>
        </InspectorSection>
      </InspectorGroup>

      {/* Advanced styling mirrors the slide builder surface for parity. */}
      <InspectorGroup title="Advanced" collapsible defaultExpanded={false}>
        <InspectorSection title="Typography fine-tuning">
          <InputSlider
            label="Line height"
            value={typography.lineHeight}
            fallbackValue={tokens.lineHeight.normal}
            min={0.8}
            max={2}
            step={0.05}
            formatValue={(current, fallback) => {
              const resolved = typeof current === 'number' ? current : fallback;
              return resolved.toFixed(2);
            }}
            onChange={(value) => updateTypography({ lineHeight: value })}
          />
          <InputSlider
            label="Letter spacing (px)"
            value={typography.letterSpacing}
            fallbackValue={0}
            min={-5}
            max={10}
            step={0.1}
            onChange={(value) => updateTypography({ letterSpacing: value })}
          />
        </InspectorSection>

        <InspectorSection title="Background">
          <InputSelect
            label="Mode"
            value={backgroundMode}
            onChange={(value) => handleBackgroundModeChange(value as NonNullable<TextBlock['background']>['mode'])}
            options={BACKGROUND_MODE_OPTIONS}
          />
          {backgroundMode === 'color' ? (
            <InputColor
              label="Background color"
              value={backgroundColorValue}
              onChange={(value) => updateBackground({ color: value })}
            />
          ) : null}
          {backgroundMode === 'gradient' ? (
            <>
              <InputColor
                label="Gradient start"
                value={gradientSettings.start ?? gradientDefaults.start}
                onChange={(value) =>
                  updateBackground({
                    gradient: {
                      ...gradientSettings,
                      start: value,
                    },
                  })
                }
              />
              <InputColor
                label="Gradient end"
                value={gradientSettings.end ?? gradientDefaults.end}
                onChange={(value) =>
                  updateBackground({
                    gradient: {
                      ...gradientSettings,
                      end: value,
                    },
                  })
                }
              />
              <InputSlider
                label="Gradient angle (°)"
                value={gradientSettings.angle}
                fallbackValue={gradientDefaults.angle}
                min={0}
                max={360}
                step={1}
                onChange={(value) =>
                  updateBackground({
                    gradient: {
                      ...gradientSettings,
                      angle: value ?? gradientDefaults.angle,
                    },
                  })
                }
              />
            </>
          ) : null}
          {backgroundMode === 'image' ? (
            <>
              <InputUpload
                label="Background image"
                buttonLabel={background.imageUrl ? 'Replace image' : 'Upload image'}
                accept="image/*"
                uploading={uploading}
                uploadingLabel="Uploading…"
                onSelectFiles={(files) => {
                  const file = files?.item(0);
                  if (file) {
                    void handleUpload(file);
                  }
                }}
              />
              <InputText
                label="Image URL"
                value={background.imageUrl ?? ''}
                onChange={(value) =>
                  updateBackground({ imageUrl: value.trim().length ? value : undefined })
                }
                placeholder="https://example.com/background.jpg"
              />
              {background.imageUrl ? (
                <div
                  style={{
                    marginTop: tokens.spacing.sm,
                    borderRadius: tokens.radius.md,
                    border: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={background.imageUrl}
                    alt=""
                    style={{ display: 'block', width: '100%', height: 'auto' }}
                  />
                </div>
              ) : null}
              {background.imageUrl ? (
                <button type="button" style={CLEAR_BUTTON_STYLE} onClick={handleRemoveBackgroundImage}>
                  Remove image
                </button>
              ) : null}
              <InputSelect
                label="Image fit"
                value={background.imageFit ?? 'cover'}
                onChange={(value) => updateBackground({ imageFit: value as 'cover' | 'contain' })}
                options={IMAGE_FIT_OPTIONS}
              />
              <InputSelect
                label="Image alignment"
                value={background.imagePosition ?? 'center'}
                onChange={(value) => updateBackground({ imagePosition: value as 'left' | 'center' | 'right' })}
                options={IMAGE_POSITION_OPTIONS}
              />
              <InputSlider
                label="Focal X (%)"
                value={focalX}
                fallbackValue={50}
                min={0}
                max={100}
                onChange={(value) => updateBackground({ focalX: value })}
              />
              <InputSlider
                label="Focal Y (%)"
                value={focalY}
                fallbackValue={50}
                min={0}
                max={100}
                onChange={(value) => updateBackground({ focalY: value })}
              />
              <InputSlider
                label="Image opacity (%)"
                value={imageOpacity}
                fallbackValue={100}
                min={0}
                max={100}
                onChange={(value) => updateBackground({ imageOpacity: value })}
              />
              <InputSlider
                label="Image blur (px)"
                value={imageBlur}
                fallbackValue={0}
                min={0}
                max={50}
                step={1}
                onChange={(value) => updateBackground({ blur: value })}
              />
            </>
          ) : null}
        </InspectorSection>

        {/* Overlay tools surface when imagery or gradients need extra contrast. */}
        {overlayActive ? (
          <InspectorSection title="Overlay">
            <InputColor
              label="Overlay color"
              value={overlayColorValue}
              onChange={(value) => updateOverlay({ color: value })}
            />
            <InputSlider
              label="Overlay opacity (%)"
              value={overlayOpacity}
              fallbackValue={0}
              min={0}
              max={100}
              onChange={(value) => updateOverlay({ opacity: value })}
            />
          </InspectorSection>
        ) : null}

        {/* Spacing sliders give teams pixel-level control around the text container. */}
        <InspectorSection title="Spacing">
          <InputSlider
            label="Margin top (px)"
            value={spacing.marginTop}
            fallbackValue={0}
            min={-128}
            max={128}
            onChange={(value) => handleSpacingChange('marginTop', value)}
          />
          <InputSlider
            label="Margin right (px)"
            value={spacing.marginRight}
            fallbackValue={0}
            min={-128}
            max={128}
            onChange={(value) => handleSpacingChange('marginRight', value)}
          />
          <InputSlider
            label="Margin bottom (px)"
            value={spacing.marginBottom}
            fallbackValue={tokens.spacing.md}
            min={-128}
            max={128}
            onChange={(value) => handleSpacingChange('marginBottom', value)}
          />
          <InputSlider
            label="Margin left (px)"
            value={spacing.marginLeft}
            fallbackValue={0}
            min={-128}
            max={128}
            onChange={(value) => handleSpacingChange('marginLeft', value)}
          />
          <InputSlider
            label="Padding top (px)"
            value={spacing.paddingTop}
            fallbackValue={0}
            min={0}
            max={160}
            onChange={(value) => handleSpacingChange('paddingTop', value)}
          />
          <InputSlider
            label="Padding right (px)"
            value={spacing.paddingRight}
            fallbackValue={0}
            min={0}
            max={160}
            onChange={(value) => handleSpacingChange('paddingRight', value)}
          />
          <InputSlider
            label="Padding bottom (px)"
            value={spacing.paddingBottom}
            fallbackValue={0}
            min={0}
            max={160}
            onChange={(value) => handleSpacingChange('paddingBottom', value)}
          />
          <InputSlider
            label="Padding left (px)"
            value={spacing.paddingLeft}
            fallbackValue={0}
            min={0}
            max={160}
            onChange={(value) => handleSpacingChange('paddingLeft', value)}
          />
        </InspectorSection>

        {/* Animation settings reuse the slide builder presets for consistent motion. */}
        <InspectorSection title="Animation">
          <InputToggle
            label="Enable animation"
            checked={Boolean(animation.enabled)}
            onChange={handleAnimationToggle}
          />
          {animation.enabled ? (
            <>
              <InputSelect
                label="Preset"
                value={animation.type ?? 'fade-in'}
                onChange={(value) => updateAnimation({ type: value as TextAnimationType })}
                options={[{ label: 'None', value: 'none' }, ...ANIMATION_OPTIONS]}
              />
              <InputSlider
                label="Duration (ms)"
                value={animation.duration}
                fallbackValue={300}
                min={0}
                max={5000}
                step={50}
                onChange={(value) => updateAnimation({ duration: value })}
              />
              <InputSlider
                label="Delay (ms)"
                value={animation.delay}
                fallbackValue={0}
                min={0}
                max={5000}
                step={50}
                onChange={(value) => updateAnimation({ delay: value })}
              />
            </>
          ) : null}
        </InspectorSection>
      </InspectorGroup>

      <style jsx>{`
        .quick-style-group {
          display: flex;
          flex-wrap: wrap;
          gap: ${tokens.spacing.xs}px;
        }
      `}</style>
    </InspectorContainer>
  );
};

export default TextInspector;
