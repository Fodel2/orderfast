import React, { useCallback, useMemo, useState } from 'react';

import FontSelect from '@/components/ui/FontSelect';
import { STORAGE_BUCKET } from '@/lib/storage';
import { normalizeFontFamily } from '@/lib/slideFonts';
import { supabase } from '@/lib/supabaseClient';
import InspectorSection, { InspectorContainer } from '@/src/components/inspector/InspectorSection';
import ControlRow from '@/src/components/inspector/ControlRow';
import InputColor from '@/src/components/inspector/controls/InputColor';
import InputSelect from '@/src/components/inspector/controls/InputSelect';
import InputSlider from '@/src/components/inspector/controls/InputSlider';
import InputText from '@/src/components/inspector/controls/InputText';
import InputTextArea from '@/src/components/inspector/controls/InputTextArea';
import InputToggle from '@/src/components/inspector/controls/InputToggle';
import InputUpload from '@/src/components/inspector/controls/InputUpload';
import { tokens } from '@/src/ui/tokens';

import type { HeaderBlock } from '../PageRenderer';

const FIT_OPTIONS = [
  { label: 'Cover', value: 'cover' },
  { label: 'Contain', value: 'contain' },
] as const;

const POSITION_OPTIONS = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
] as const;

const ALIGNMENT_OPTIONS = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
] as const;

const FONT_WEIGHT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Regular (400)', value: '400' },
  { label: 'Medium (500)', value: '500' },
  { label: 'Semibold (600)', value: '600' },
  { label: 'Bold (700)', value: '700' },
  { label: 'Extra Bold (800)', value: '800' },
];

type HeaderInspectorProps = {
  block: HeaderBlock;
  onChange: (patch: Partial<HeaderBlock>) => void;
  restaurantId: string;
};

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

const createStoragePath = (restaurantId: string, fileName: string) => {
  const ext = fileName.split('.').pop() || 'jpg';
  return `webpage-headers/${restaurantId}/${crypto.randomUUID()}.${ext}`;
};

const getErrorMessage = (error: unknown) => {
  if (!error) return 'Unknown error';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in (error as Record<string, unknown>)) {
    return String((error as Record<string, unknown>).message);
  }
  return String(error);
};

const resolveFontValue = (value?: HeaderBlock['fontFamily']) =>
  normalizeFontFamily(value) ?? 'default';

const HeaderInspector: React.FC<HeaderInspectorProps> = ({ block, onChange, restaurantId }) => {
  const [uploading, setUploading] = useState(false);

  const fontValue = useMemo(() => resolveFontValue(block.fontFamily), [block.fontFamily]);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!restaurantId) return;
      setUploading(true);
      try {
        const path = createStoragePath(restaurantId, file.name);
        const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
          upsert: true,
        });
        if (error) {
          throw error;
        }
        const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        if (data?.publicUrl) {
          onChange({ backgroundImageUrl: data.publicUrl });
        }
      } catch (error) {
        // eslint-disable-next-line no-alert
        alert(`Failed to upload background image: ${getErrorMessage(error)}`);
      } finally {
        setUploading(false);
      }
    },
    [onChange, restaurantId],
  );

  return (
    <InspectorContainer>
      <InspectorSection title="Content">
        <InputText
          label="Title"
          value={block.title}
          onChange={(value) => onChange({ title: value })}
        />
        <InputTextArea
          label="Subtitle"
          value={block.subtitle ?? ''}
          onChange={(value) => onChange({ subtitle: value })}
          rows={3}
        />
        <InputText
          label="Tagline"
          value={block.tagline ?? ''}
          onChange={(value) => onChange({ tagline: value })}
          placeholder="Optional short phrase"
        />
      </InspectorSection>

      <InspectorSection title="Media">
        <InputUpload
          label="Background image"
          buttonLabel={block.backgroundImageUrl ? 'Replace image' : 'Upload image'}
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
          value={block.backgroundImageUrl ?? ''}
          onChange={(value) => onChange({ backgroundImageUrl: value.trim().length ? value : null })}
          placeholder="https://example.com/header.jpg"
        />
        {block.backgroundImageUrl ? (
          <div
            style={{
              marginTop: tokens.spacing.sm,
              border: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
              borderRadius: tokens.radius.md,
              overflow: 'hidden',
            }}
          >
            <img
              src={block.backgroundImageUrl}
              alt=""
              style={{ display: 'block', width: '100%', height: 'auto' }}
            />
          </div>
        ) : null}
        {block.backgroundImageUrl ? (
          <button
            type="button"
            style={CLEAR_BUTTON_STYLE}
            onClick={() => onChange({ backgroundImageUrl: null })}
          >
            Remove image
          </button>
        ) : null}
        <InputSelect
          label="Object fit"
          value={block.backgroundImageFit ?? 'cover'}
          onChange={(value) => onChange({ backgroundImageFit: value as HeaderBlock['backgroundImageFit'] })}
          options={FIT_OPTIONS.map((option) => ({ label: option.label, value: option.value }))}
        />
        <InputSelect
          label="Alignment"
          value={block.backgroundImagePosition ?? 'center'}
          onChange={(value) =>
            onChange({ backgroundImagePosition: value as HeaderBlock['backgroundImagePosition'] })
          }
          options={POSITION_OPTIONS.map((option) => ({ label: option.label, value: option.value }))}
        />
      </InspectorSection>

      <InspectorSection title="Overlay">
        <InputToggle
          label="Overlay text"
          checked={block.overlayEnabled ?? false}
          onChange={(checked) => onChange({ overlayEnabled: checked })}
        />
        {(block.overlayEnabled ?? false) ? (
          <>
            <InputColor
              label="Overlay color"
              value={block.overlayColor ?? '#0f172a'}
              onChange={(value) => onChange({ overlayColor: value })}
            />
            <InputSlider
              label="Overlay opacity (%)"
              value={block.overlayOpacity ?? 65}
              fallbackValue={65}
              min={0}
              max={100}
              step={1}
              onChange={(value) => onChange({ overlayOpacity: value ?? 65 })}
            />
          </>
        ) : null}
      </InspectorSection>

      <InspectorSection title="Typography">
        <ControlRow label="Font family">
          <FontSelect
            value={fontValue}
            onChange={(value) => onChange({ fontFamily: normalizeFontFamily(value) ?? 'default' })}
          />
        </ControlRow>
        <InputSelect
          label="Font weight"
          value={String(block.fontWeight ?? 700)}
          onChange={(value) => onChange({ fontWeight: Number.parseInt(value, 10) || 700 })}
          options={FONT_WEIGHT_OPTIONS}
        />
        <InputSlider
          label="Title size (px)"
          value={block.titleFontSize ?? 48}
          fallbackValue={48}
          min={24}
          max={120}
          step={1}
          onChange={(value) => onChange({ titleFontSize: value ?? 48 })}
        />
        <InputSlider
          label="Line height"
          value={block.titleLineHeight ?? 1.1}
          fallbackValue={1.1}
          min={0.8}
          max={2}
          step={0.05}
          formatValue={(current, fallback) => {
            const resolved = typeof current === 'number' ? current : fallback;
            return resolved.toFixed(2);
          }}
          onChange={(value) => onChange({ titleLineHeight: value ?? 1.1 })}
        />
        <InputSlider
          label="Letter spacing (px)"
          value={block.titleLetterSpacing ?? -1}
          fallbackValue={-1}
          min={-5}
          max={10}
          step={0.1}
          onChange={(value) => onChange({ titleLetterSpacing: value ?? -1 })}
        />
        <InputColor
          label="Title color"
          value={block.titleColor ?? '#ffffff'}
          onChange={(value) => onChange({ titleColor: value })}
        />
        <InputColor
          label="Subtitle color"
          value={block.subtitleColor ?? 'rgba(255, 255, 255, 0.9)'}
          onChange={(value) => onChange({ subtitleColor: value })}
        />
        <InputColor
          label="Tagline color"
          value={block.taglineColor ?? 'rgba(255, 255, 255, 0.75)'}
          onChange={(value) => onChange({ taglineColor: value })}
        />
      </InspectorSection>

      <InspectorSection title="Layout">
        <InputSlider
          label="Header height (vh)"
          value={block.headerHeight ?? 80}
          fallbackValue={80}
          min={40}
          max={100}
          step={1}
          onChange={(value) => onChange({ headerHeight: value ?? 80 })}
        />
        <InputSlider
          label="Padding top (px)"
          value={block.paddingTop ?? 160}
          fallbackValue={160}
          min={32}
          max={320}
          step={4}
          onChange={(value) => onChange({ paddingTop: value ?? 160 })}
        />
        <InputSlider
          label="Padding bottom (px)"
          value={block.paddingBottom ?? 160}
          fallbackValue={160}
          min={32}
          max={320}
          step={4}
          onChange={(value) => onChange({ paddingBottom: value ?? 160 })}
        />
        <InputSelect
          label="Text alignment"
          value={block.align ?? 'center'}
          onChange={(value) => onChange({ align: value as HeaderBlock['align'] })}
          options={ALIGNMENT_OPTIONS.map((option) => ({ label: option.label, value: option.value }))}
        />
        <InputToggle
          label="Full width"
          checked={block.fullWidth ?? true}
          onChange={(checked) => onChange({ fullWidth: checked })}
        />
      </InspectorSection>
    </InspectorContainer>
  );
};

export default HeaderInspector;
