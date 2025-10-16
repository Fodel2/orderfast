import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { STORAGE_BUCKET } from '@/lib/storage';
import { supabase } from '@/lib/supabaseClient';
import InspectorSection, {
  InspectorContainer,
  InspectorGroup,
} from '@/src/components/inspector/InspectorSection';
import InputColor from '@/src/components/inspector/controls/InputColor';
import InputSelect, { type InputSelectOption } from '@/src/components/inspector/controls/InputSelect';
import InputSlider from '@/src/components/inspector/controls/InputSlider';
import InputText from '@/src/components/inspector/controls/InputText';
import InputToggle from '@/src/components/inspector/controls/InputToggle';
import InputUpload from '@/src/components/inspector/controls/InputUpload';
import { tokens } from '@/src/ui/tokens';

import type { ImageBlock, TextAnimationType } from '../PageRenderer';
import {
  ANIMATION_OPTIONS,
  BACKGROUND_MODE_OPTIONS,
  CLEAR_BUTTON_STYLE,
  IMAGE_FIT_OPTIONS,
  IMAGE_POSITION_OPTIONS,
  extractHexFallback,
  gradientDefaults,
  mergeNested,
} from './inspector/shared';

const RADIUS_OPTIONS: InputSelectOption[] = [
  { label: 'None', value: 'none' },
  { label: 'Small', value: 'sm' },
  { label: 'Medium', value: 'md' },
  { label: 'Large', value: 'lg' },
  { label: 'Extra Large', value: 'xl' },
  { label: '2XL', value: '2xl' },
  { label: 'Pill', value: 'full' },
];

const createStoragePath = (restaurantId: string, fileName: string) => {
  const ext = fileName.split('.').pop() || 'jpg';
  return `webpage-images/${restaurantId}/${crypto.randomUUID()}.${ext}`;
};

const getErrorMessage = (error: unknown) => {
  if (!error) return 'Unknown error';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in (error as Record<string, unknown>)) {
    return String((error as Record<string, unknown>).message);
  }
  return String(error);
};

type ImageInspectorProps = {
  block: ImageBlock;
  onChange: (patch: Partial<ImageBlock>) => void;
  restaurantId: string;
  triggerAutoSave: () => void;
};

const ImageInspector: React.FC<ImageInspectorProps> = ({ block, onChange, restaurantId, triggerAutoSave }) => {
  const [uploading, setUploading] = useState(false);
  const [backgroundUpload, setBackgroundUpload] = useState(false);

  const spacing = block.spacing ?? {};
  const background = block.background ?? { mode: 'none', type: 'none' };
  const overlay = block.overlay ?? {};
  const animation = block.animation ?? {};

  const backgroundType = background.type ?? background.mode ?? 'none';
  const gradientSettings = background.gradient ?? gradientDefaults;
  const hasBackgroundImage = backgroundType === 'image' && Boolean(background.imageUrl);
  const overlayActive = backgroundType === 'gradient' || hasBackgroundImage;

  const fallbackBackgroundColor = useMemo(
    () => extractHexFallback(tokens.colors.surface, '#ffffff'),
    [],
  );
  const initialBackgroundColor = background.color ?? fallbackBackgroundColor;
  const [backgroundColorDraft, setBackgroundColorDraft] = useState(initialBackgroundColor);

  useEffect(() => {
    setBackgroundColorDraft(initialBackgroundColor);
  }, [initialBackgroundColor]);

  const updateSpacing = useCallback(
    (patch: Partial<NonNullable<ImageBlock['spacing']>>) => {
      const next = mergeNested(block.spacing, patch);
      onChange({ spacing: next });
    },
    [block.spacing, onChange],
  );

  const updateBackground = useCallback(
    (patch: Partial<NonNullable<ImageBlock['background']>>) => {
      const next = mergeNested(block.background, patch);
      onChange({ background: next });
    },
    [block.background, onChange],
  );

  const updateOverlay = useCallback(
    (patch: Partial<NonNullable<ImageBlock['overlay']>>) => {
      const next = mergeNested(block.overlay, patch);
      onChange({ overlay: next });
    },
    [block.overlay, onChange],
  );

  const updateAnimation = useCallback(
    (patch: Partial<NonNullable<ImageBlock['animation']>>) => {
      const next = mergeNested(block.animation, patch);
      onChange({ animation: next });
    },
    [block.animation, onChange],
  );

  const handleSpacingChange = useCallback(
    (key: keyof NonNullable<ImageBlock['spacing']>, value: number | undefined) => {
      updateSpacing({ [key]: value } as Partial<NonNullable<ImageBlock['spacing']>>);
    },
    [updateSpacing],
  );

  const handleBackgroundModeChange = useCallback(
    (mode: NonNullable<ImageBlock['background']>['mode']) => {
      let next = mergeNested(block.background, { type: mode, mode });
      if (!next) {
        next = { type: mode, mode } as NonNullable<ImageBlock['background']>;
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
      triggerAutoSave();
    },
    [block.background, onChange, triggerAutoSave],
  );

  const handleBackgroundColorChange = useCallback(
    (value: string) => {
      const next = value?.trim().length ? value : fallbackBackgroundColor;
      setBackgroundColorDraft(next);
      updateBackground({
        type: 'color',
        mode: 'color',
        color: next,
      });
    },
    [fallbackBackgroundColor, updateBackground],
  );

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!restaurantId) return;
      setUploading(true);
      try {
        const path = createStoragePath(restaurantId, file.name);
        const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        if (data?.publicUrl) {
          onChange({ src: data.publicUrl });
          triggerAutoSave();
        }
      } catch (error) {
        // eslint-disable-next-line no-alert
        alert(`Failed to upload image: ${getErrorMessage(error)}`);
      } finally {
        setUploading(false);
      }
    },
    [onChange, restaurantId, triggerAutoSave],
  );

  const handleBackgroundUpload = useCallback(
    async (file: File) => {
      if (!restaurantId) return;
      setBackgroundUpload(true);
      try {
        const path = `webpage-image-backgrounds/${restaurantId}/${crypto.randomUUID()}.${file.name.split('.').pop() || 'jpg'}`;
        const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        if (data?.publicUrl) {
          updateBackground({ type: 'image', mode: 'image', imageUrl: data.publicUrl });
          triggerAutoSave();
        }
      } catch (error) {
        // eslint-disable-next-line no-alert
        alert(`Failed to upload background image: ${getErrorMessage(error)}`);
      } finally {
        setBackgroundUpload(false);
      }
    },
    [restaurantId, triggerAutoSave, updateBackground],
  );

  return (
    <InspectorContainer>
      <InspectorGroup title="Basic">
        <InspectorSection title="Media">
          <InputUpload
            label="Image"
            buttonLabel={block.src ? 'Replace image' : 'Upload image'}
            accept="image/*"
            uploading={uploading}
            uploadingLabel="Uploading…"
            onSelectFiles={(files) => {
              const file = files?.item(0);
              if (file) {
                void handleImageUpload(file);
              }
            }}
          />
          <InputText
            label="Image URL"
            value={block.src}
            onChange={(value) => onChange({ src: value })}
            placeholder="https://"
          />
          <InputText
            label="Alt text"
            value={block.alt ?? ''}
            onChange={(value) => onChange({ alt: value })}
            placeholder="Describe the image for accessibility"
          />
          <InputSlider
            label="Max width (px)"
            value={block.width}
            fallbackValue={960}
            min={120}
            max={1920}
            step={10}
            onChange={(value) => onChange({ width: value })}
          />
          <InputSelect
            label="Fit"
            value={block.fit ?? 'cover'}
            onChange={(value) => onChange({ fit: value as ImageBlock['fit'] })}
            options={IMAGE_FIT_OPTIONS}
          />
          <InputSlider
            label="Aspect ratio"
            value={block.aspectRatio}
            fallbackValue={1.5}
            min={0.5}
            max={3}
            step={0.05}
            onChange={(value) => onChange({ aspectRatio: value })}
            formatValue={(value, fallback) => {
              const resolved = typeof value === 'number' ? value : fallback;
              return resolved.toFixed(2);
            }}
          />
          <button
            type="button"
            style={CLEAR_BUTTON_STYLE}
            onClick={() => onChange({ aspectRatio: undefined })}
          >
            Reset aspect ratio
          </button>
          <InputSlider
            label="Focal X (%)"
            value={block.focalX}
            fallbackValue={50}
            min={0}
            max={100}
            step={1}
            onChange={(value) => onChange({ focalX: value })}
          />
          <InputSlider
            label="Focal Y (%)"
            value={block.focalY}
            fallbackValue={50}
            min={0}
            max={100}
            step={1}
            onChange={(value) => onChange({ focalY: value })}
          />
          <InputSelect
            label="Corner radius"
            value={block.radius ?? 'lg'}
            onChange={(value) => onChange({ radius: value as ImageBlock['radius'] })}
            options={RADIUS_OPTIONS}
          />
        </InspectorSection>
      </InspectorGroup>

      <InspectorGroup title="Advanced" collapsible defaultExpanded={false}>
        <InspectorSection title="Background">
          <InputSelect
            label="Mode"
            value={backgroundType}
            onChange={(value) =>
              handleBackgroundModeChange(value as NonNullable<ImageBlock['background']>['mode'])
            }
            options={BACKGROUND_MODE_OPTIONS}
          />
          {backgroundType === 'color' ? (
            <InputColor
              label="Background color"
              value={backgroundColorDraft}
              onChange={handleBackgroundColorChange}
            />
          ) : null}
          {backgroundType === 'gradient' ? (
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
                label="Gradient angle"
                value={gradientSettings.angle}
                fallbackValue={gradientDefaults.angle}
                min={0}
                max={360}
                step={1}
                onChange={(value) =>
                  updateBackground({
                    gradient: {
                      ...gradientSettings,
                      angle: value,
                    },
                  })
                }
              />
            </>
          ) : null}
          {backgroundType === 'image' ? (
            <>
              <InputUpload
                label="Background image"
                buttonLabel={background.imageUrl ? 'Replace image' : 'Upload image'}
                accept="image/*"
                uploading={backgroundUpload}
                uploadingLabel="Uploading…"
                onSelectFiles={(files) => {
                  const file = files?.item(0);
                  if (file) {
                    void handleBackgroundUpload(file);
                  }
                }}
              />
              <InputText
                label="Background image URL"
                value={background.imageUrl ?? ''}
                onChange={(value) => updateBackground({ imageUrl: value })}
              />
              <InputSelect
                label="Image fit"
                value={background.imageFit ?? 'cover'}
                onChange={(value) => updateBackground({ imageFit: value as 'cover' | 'contain' })}
                options={IMAGE_FIT_OPTIONS}
              />
              <InputSelect
                label="Image position"
                value={background.imagePosition ?? 'center'}
                onChange={(value) => updateBackground({ imagePosition: value as 'left' | 'center' | 'right' })}
                options={IMAGE_POSITION_OPTIONS}
              />
              <InputSlider
                label="Focal X (%)"
                value={background.focalX}
                fallbackValue={50}
                min={0}
                max={100}
                onChange={(value) => updateBackground({ focalX: value })}
              />
              <InputSlider
                label="Focal Y (%)"
                value={background.focalY}
                fallbackValue={50}
                min={0}
                max={100}
                onChange={(value) => updateBackground({ focalY: value })}
              />
              <InputSlider
                label="Image opacity (%)"
                value={background.imageOpacity}
                fallbackValue={100}
                min={0}
                max={100}
                onChange={(value) => updateBackground({ imageOpacity: value })}
              />
              <InputSlider
                label="Blur (px)"
                value={background.blur}
                fallbackValue={0}
                min={0}
                max={40}
                onChange={(value) => updateBackground({ blur: value })}
              />
            </>
          ) : null}
        </InspectorSection>

        {overlayActive ? (
          <InspectorSection title="Overlay">
            <InputColor
              label="Overlay color"
              value={overlay.color ?? '#0f172a'}
              onChange={(value) => updateOverlay({ color: value })}
            />
            <InputSlider
              label="Overlay opacity (%)"
              value={overlay.opacity}
              fallbackValue={50}
              min={0}
              max={100}
              onChange={(value) => updateOverlay({ opacity: value })}
            />
          </InspectorSection>
        ) : null}

        <InspectorSection title="Spacing">
          <InputSlider
            label="Margin top"
            value={spacing.marginTop}
            fallbackValue={0}
            min={0}
            max={160}
            step={1}
            onChange={(value) => handleSpacingChange('marginTop', value)}
          />
          <InputSlider
            label="Margin right"
            value={spacing.marginRight}
            fallbackValue={0}
            min={0}
            max={160}
            step={1}
            onChange={(value) => handleSpacingChange('marginRight', value)}
          />
          <InputSlider
            label="Margin bottom"
            value={spacing.marginBottom}
            fallbackValue={tokens.spacing.md}
            min={0}
            max={160}
            step={1}
            onChange={(value) => handleSpacingChange('marginBottom', value)}
          />
          <InputSlider
            label="Margin left"
            value={spacing.marginLeft}
            fallbackValue={0}
            min={0}
            max={160}
            step={1}
            onChange={(value) => handleSpacingChange('marginLeft', value)}
          />
          <InputSlider
            label="Padding top"
            value={spacing.paddingTop}
            fallbackValue={0}
            min={0}
            max={160}
            step={1}
            onChange={(value) => handleSpacingChange('paddingTop', value)}
          />
          <InputSlider
            label="Padding right"
            value={spacing.paddingRight}
            fallbackValue={0}
            min={0}
            max={160}
            step={1}
            onChange={(value) => handleSpacingChange('paddingRight', value)}
          />
          <InputSlider
            label="Padding bottom"
            value={spacing.paddingBottom}
            fallbackValue={0}
            min={0}
            max={160}
            step={1}
            onChange={(value) => handleSpacingChange('paddingBottom', value)}
          />
          <InputSlider
            label="Padding left"
            value={spacing.paddingLeft}
            fallbackValue={0}
            min={0}
            max={160}
            step={1}
            onChange={(value) => handleSpacingChange('paddingLeft', value)}
          />
        </InspectorSection>

        <InspectorSection title="Animation">
          <InputToggle
            label="Enable animation"
            checked={Boolean(animation.enabled)}
            onChange={(checked) => updateAnimation({ enabled: checked })}
          />
          <InputSelect
            label="Type"
            value={animation.type ?? 'fade-in'}
            onChange={(value) => updateAnimation({ type: value as TextAnimationType })}
            options={ANIMATION_OPTIONS}
          />
          <InputSlider
            label="Duration (ms)"
            value={animation.duration}
            fallbackValue={300}
            min={0}
            max={2000}
            step={50}
            onChange={(value) => updateAnimation({ duration: value })}
          />
          <InputSlider
            label="Delay (ms)"
            value={animation.delay}
            fallbackValue={0}
            min={0}
            max={2000}
            step={50}
            onChange={(value) => updateAnimation({ delay: value })}
          />
        </InspectorSection>
      </InspectorGroup>
    </InspectorContainer>
  );
};

export default ImageInspector;
