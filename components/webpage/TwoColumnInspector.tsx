import React, { useCallback, useState } from 'react';

import InspectorSection, {
  InspectorContainer,
  InspectorGroup,
} from '@/src/components/inspector/InspectorSection';
import InputColor from '@/src/components/inspector/controls/InputColor';
import InputSelect, { type InputSelectOption } from '@/src/components/inspector/controls/InputSelect';
import InputSlider from '@/src/components/inspector/controls/InputSlider';
import InputText from '@/src/components/inspector/controls/InputText';
import InputTextArea from '@/src/components/inspector/controls/InputTextArea';
import InputToggle from '@/src/components/inspector/controls/InputToggle';
import InputUpload from '@/src/components/inspector/controls/InputUpload';
import { tokens } from '@/src/ui/tokens';

import { STORAGE_BUCKET } from '@/lib/storage';
import { supabase } from '@/lib/supabaseClient';

import type {
  ImageBlock,
  TextAnimationType,
  TextBlock,
  TwoColumnBlock,
  TwoColumnColumn,
} from '../PageRenderer';
import AlignmentControl from './inspector/AlignmentControl';
import {
  ANIMATION_OPTIONS,
  BACKGROUND_MODE_OPTIONS,
  CLEAR_BUTTON_STYLE,
  IMAGE_FIT_OPTIONS,
  IMAGE_POSITION_OPTIONS,
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

const TEXT_PLACEHOLDER = 'Tell your story here.';

const createTextBlock = (overrides?: Partial<TextBlock>): TextBlock => ({
  id: overrides?.id ?? crypto.randomUUID(),
  type: 'text',
  text: overrides?.text ?? TEXT_PLACEHOLDER,
  align: overrides?.align ?? 'left',
  typography: overrides?.typography,
  background: overrides?.background,
  spacing: overrides?.spacing,
  overlay: overrides?.overlay,
  animation: overrides?.animation,
});

const createImageBlock = (overrides?: Partial<ImageBlock>): ImageBlock => ({
  id: overrides?.id ?? crypto.randomUUID(),
  type: 'image',
  src: overrides?.src ?? 'https://placehold.co/800x600',
  alt: overrides?.alt ?? 'Column image',
  width: overrides?.width ?? 720,
  radius: overrides?.radius ?? 'lg',
  fit: overrides?.fit ?? 'cover',
  ...overrides,
});

const getErrorMessage = (error: unknown) => {
  if (!error) return 'Unknown error';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in (error as Record<string, unknown>)) {
    return String((error as Record<string, unknown>).message);
  }
  return String(error);
};

type ColumnKey = 'left' | 'right';

type TwoColumnInspectorProps = {
  block: TwoColumnBlock;
  onChange: (patch: Partial<TwoColumnBlock>) => void;
  restaurantId: string;
};

const TwoColumnInspector: React.FC<TwoColumnInspectorProps> = ({ block, onChange, restaurantId }) => {
  const spacing = block.spacing ?? {};
  const background = block.background ?? { mode: 'none', type: 'none' };
  const overlay = block.overlay ?? {};
  const animation = block.animation ?? {};

  const [uploadingColumn, setUploadingColumn] = useState<null | ColumnKey>(null);
  const [uploadingBackground, setUploadingBackground] = useState(false);

  const updateSpacing = useCallback(
    (patch: Partial<NonNullable<TwoColumnBlock['spacing']>>) => {
      const next = mergeNested(block.spacing, patch);
      onChange({ spacing: next });
    },
    [block.spacing, onChange],
  );

  const handleSpacingChange = useCallback(
    (key: keyof NonNullable<TwoColumnBlock['spacing']>, value: number | undefined) => {
      updateSpacing({ [key]: value } as Partial<NonNullable<TwoColumnBlock['spacing']>>);
    },
    [updateSpacing],
  );

  const updateBackground = useCallback(
    (patch: Partial<NonNullable<TwoColumnBlock['background']>>) => {
      const next = mergeNested(block.background, patch);
      onChange({ background: next });
    },
    [block.background, onChange],
  );

  const handleBackgroundModeChange = useCallback(
    (mode: NonNullable<TwoColumnBlock['background']>['mode']) => {
      let next = mergeNested(block.background, { type: mode, mode });
      if (!next) {
        next = { type: mode, mode } as NonNullable<TwoColumnBlock['background']>;
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
    },
    [block.background, onChange],
  );

  const updateOverlay = useCallback(
    (patch: Partial<NonNullable<TwoColumnBlock['overlay']>>) => {
      const next = mergeNested(block.overlay, patch);
      onChange({ overlay: next });
    },
    [block.overlay, onChange],
  );

  const updateAnimation = useCallback(
    (patch: Partial<NonNullable<TwoColumnBlock['animation']>>) => {
      const next = mergeNested(block.animation, patch);
      onChange({ animation: next });
    },
    [block.animation, onChange],
  );

  const updateColumn = useCallback(
    (key: ColumnKey, updater: (column: TwoColumnColumn) => TwoColumnColumn) => {
      const nextColumn = updater(block[key]);
      onChange({ [key]: nextColumn });
    },
    [block, onChange],
  );

  const handleTextChange = useCallback(
    (key: ColumnKey, text: string) => {
      updateColumn(key, (column) => {
        const current = column.text ?? createTextBlock({ text: TEXT_PLACEHOLDER });
        return { ...column, text: { ...current, text } };
      });
    },
    [updateColumn],
  );

  const handleTextAlign = useCallback(
    (key: ColumnKey, align: 'left' | 'center' | 'right') => {
      updateColumn(key, (column) => {
        const current = column.text ?? createTextBlock({});
        return { ...column, text: { ...current, align } };
      });
    },
    [updateColumn],
  );

  const handleImageChange = useCallback(
    (key: ColumnKey, patch: Partial<ImageBlock>) => {
      updateColumn(key, (column) => {
        let nextPatch = { ...patch };
        if (typeof nextPatch.src === 'string') {
          const normalized = nextPatch.src.trim();
          if (!normalized.length) {
            return { ...column, image: null, wrapTextAroundImage: false };
          }
          nextPatch = { ...nextPatch, src: normalized };
        }

        const baseImage = column.image ?? createImageBlock({ src: 'https://placehold.co/800x600' });
        return { ...column, image: { ...baseImage, ...nextPatch } };
      });
    },
    [updateColumn],
  );

  const handleRemoveImage = useCallback(
    (key: ColumnKey) => {
      updateColumn(key, (column) => ({ ...column, image: null, wrapTextAroundImage: false }));
    },
    [updateColumn],
  );

  const handleImageAlignment = useCallback(
    (key: ColumnKey, alignment: TwoColumnColumn['imageAlignment']) => {
      updateColumn(key, (column) => ({ ...column, imageAlignment: alignment }));
    },
    [updateColumn],
  );

  const handleWrapToggle = useCallback(
    (key: ColumnKey, enabled: boolean) => {
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
    },
    [updateColumn],
  );

  const handleImageSpacing = useCallback(
    (key: ColumnKey, value: number) => {
      updateColumn(key, (column) => ({ ...column, imageSpacing: value }));
    },
    [updateColumn],
  );

  const handleImageUpload = useCallback(
    async (key: ColumnKey, file: File) => {
      if (!restaurantId) return;
      setUploadingColumn(key);
      try {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `webpage-columns/${restaurantId}/${key}-${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        if (data?.publicUrl) {
          handleImageChange(key, { src: data.publicUrl });
        }
      } catch (error) {
        // eslint-disable-next-line no-alert
        alert(`Failed to upload image: ${getErrorMessage(error)}`);
      } finally {
        setUploadingColumn(null);
      }
    },
    [handleImageChange, restaurantId],
  );

  const handleBackgroundUpload = useCallback(
    async (file: File) => {
      if (!restaurantId) return;
      setUploadingBackground(true);
      try {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `webpage-two-column/${restaurantId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        if (data?.publicUrl) {
          updateBackground({ type: 'image', mode: 'image', imageUrl: data.publicUrl });
        }
      } catch (error) {
        // eslint-disable-next-line no-alert
        alert(`Failed to upload background image: ${getErrorMessage(error)}`);
      } finally {
        setUploadingBackground(false);
      }
    },
    [restaurantId, updateBackground],
  );

  const renderColumnControls = (key: ColumnKey, label: string) => {
    const column = block[key];
    const text = column.text ?? createTextBlock({ text: TEXT_PLACEHOLDER });
    const image = column.image ?? null;
    const wrapEnabled = Boolean(column.wrapTextAroundImage);

    return (
      <InspectorSection key={key} title={label}>
        <InputTextArea
          label="Text"
          value={text.text}
          rows={4}
          onChange={(value) => handleTextChange(key, value)}
        />
        <AlignmentControl value={text.align ?? 'left'} onChange={(align) => handleTextAlign(key, align)} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
          <InputUpload
            label="Image"
            buttonLabel={image?.src ? 'Replace image' : 'Upload image'}
            accept="image/*"
            uploading={uploadingColumn === key}
            uploadingLabel="Uploading…"
            onSelectFiles={(files) => {
              const file = files?.item(0);
              if (file) {
                void handleImageUpload(key, file);
              }
            }}
          />
          {image ? (
            <button type="button" style={CLEAR_BUTTON_STYLE} onClick={() => handleRemoveImage(key)}>
              Remove image
            </button>
          ) : null}
        </div>
        <InputText
          label="Image URL"
          value={image?.src ?? ''}
          onChange={(value) => handleImageChange(key, { src: value })}
          placeholder="https://"
        />
        <InputText
          label="Alt text"
          value={image?.alt ?? ''}
          onChange={(value) => handleImageChange(key, { alt: value })}
        />
        <InputSlider
          label="Image width (px)"
          value={image?.width}
          fallbackValue={720}
          min={120}
          max={1280}
          step={10}
          onChange={(value) => handleImageChange(key, { width: value })}
        />
        <InputSelect
          label="Fit"
          value={image?.fit ?? 'cover'}
          onChange={(value) => handleImageChange(key, { fit: value as ImageBlock['fit'] })}
          options={IMAGE_FIT_OPTIONS}
        />
        <InputSelect
          label="Position"
          value={column.imageAlignment ?? 'top'}
          onChange={(value) => handleImageAlignment(key, value as TwoColumnColumn['imageAlignment'])}
          options={[
            { label: 'Top', value: 'top' },
            { label: 'Bottom', value: 'bottom' },
            { label: 'Left', value: 'left' },
            { label: 'Right', value: 'right' },
          ]}
        />
        <InputSelect
          label="Corner radius"
          value={image?.radius ?? 'lg'}
          onChange={(value) => handleImageChange(key, { radius: value as ImageBlock['radius'] })}
          options={RADIUS_OPTIONS}
        />
        <InputToggle
          label="Wrap text around image"
          checked={wrapEnabled}
          disabled={!image}
          onChange={(checked) => handleWrapToggle(key, checked)}
        />
        {wrapEnabled ? (
          <InputSlider
            label="Wrap spacing (px)"
            value={column.imageSpacing}
            fallbackValue={tokens.spacing.md}
            min={0}
            max={160}
            step={4}
            onChange={(value) => handleImageSpacing(key, value ?? tokens.spacing.md)}
          />
        ) : null}
      </InspectorSection>
    );
  };

  const backgroundType = background.type ?? background.mode ?? 'none';
  const gradientSettings = background.gradient ?? gradientDefaults;
  const hasBackgroundImage = backgroundType === 'image' && Boolean(background.imageUrl);
  const overlayActive = backgroundType === 'gradient' || hasBackgroundImage;

  return (
    <InspectorContainer>
      <InspectorGroup title="Basic">
        <InspectorSection title="Layout">
          <InputSelect
            label="Column ratio"
            value={block.ratio ?? '1-1'}
            onChange={(value) => onChange({ ratio: value as TwoColumnBlock['ratio'] })}
            options={[
              { label: '50 / 50', value: '1-1' },
              { label: '33 / 67', value: '1-2' },
              { label: '67 / 33', value: '2-1' },
            ]}
          />
          <InputSlider
            label="Gap (px)"
            value={block.gap}
            fallbackValue={tokens.spacing.lg}
            min={0}
            max={200}
            step={4}
            onChange={(value) => onChange({ gap: value })}
          />
          <InputSlider
            label="Padding (px)"
            value={block.padding}
            fallbackValue={tokens.spacing.lg}
            min={0}
            max={200}
            step={4}
            onChange={(value) => onChange({ padding: value })}
          />
        </InspectorSection>
        {renderColumnControls('left', 'Left column')}
        {renderColumnControls('right', 'Right column')}
      </InspectorGroup>

      <InspectorGroup title="Advanced" collapsible defaultExpanded={false}>
        <InspectorSection title="Background">
          <InputSelect
            label="Mode"
            value={backgroundType}
            onChange={(value) => handleBackgroundModeChange(value as NonNullable<TwoColumnBlock['background']>['mode'])}
            options={BACKGROUND_MODE_OPTIONS}
          />
          {backgroundType === 'color' ? (
            <InputColor
              label="Background color"
              value={background.color ?? '#ffffff'}
              onChange={(value) => updateBackground({ color: value })}
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
                uploading={uploadingBackground}
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
            fallbackValue={tokens.spacing.md}
            min={0}
            max={200}
            step={4}
            onChange={(value) => handleSpacingChange('marginTop', value)}
          />
          <InputSlider
            label="Margin right"
            value={spacing.marginRight}
            fallbackValue={0}
            min={0}
            max={200}
            step={4}
            onChange={(value) => handleSpacingChange('marginRight', value)}
          />
          <InputSlider
            label="Margin bottom"
            value={spacing.marginBottom}
            fallbackValue={tokens.spacing.md}
            min={0}
            max={200}
            step={4}
            onChange={(value) => handleSpacingChange('marginBottom', value)}
          />
          <InputSlider
            label="Margin left"
            value={spacing.marginLeft}
            fallbackValue={0}
            min={0}
            max={200}
            step={4}
            onChange={(value) => handleSpacingChange('marginLeft', value)}
          />
          <InputSlider
            label="Padding top"
            value={spacing.paddingTop}
            fallbackValue={block.padding ?? tokens.spacing.lg}
            min={0}
            max={200}
            step={4}
            onChange={(value) => handleSpacingChange('paddingTop', value)}
          />
          <InputSlider
            label="Padding right"
            value={spacing.paddingRight}
            fallbackValue={block.padding ?? tokens.spacing.lg}
            min={0}
            max={200}
            step={4}
            onChange={(value) => handleSpacingChange('paddingRight', value)}
          />
          <InputSlider
            label="Padding bottom"
            value={spacing.paddingBottom}
            fallbackValue={block.padding ?? tokens.spacing.lg}
            min={0}
            max={200}
            step={4}
            onChange={(value) => handleSpacingChange('paddingBottom', value)}
          />
          <InputSlider
            label="Padding left"
            value={spacing.paddingLeft}
            fallbackValue={block.padding ?? tokens.spacing.lg}
            min={0}
            max={200}
            step={4}
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

export default TwoColumnInspector;
