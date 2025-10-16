import React, { useCallback, useMemo } from 'react';

import FontSelect from '@/components/ui/FontSelect';
import InspectorSection, {
  InspectorContainer,
  InspectorGroup,
} from '@/src/components/inspector/InspectorSection';
import ControlRow from '@/src/components/inspector/ControlRow';
import InputColor from '@/src/components/inspector/controls/InputColor';
import InputSelect from '@/src/components/inspector/controls/InputSelect';
import InputSlider from '@/src/components/inspector/controls/InputSlider';
import InputText from '@/src/components/inspector/controls/InputText';
import InputToggle from '@/src/components/inspector/controls/InputToggle';
import { tokens } from '@/src/ui/tokens';

import { normalizeFontFamily } from '@/lib/slideFonts';

import type { ButtonBlock, TextAnimationType } from '../PageRenderer';
import AlignmentControl from './inspector/AlignmentControl';
import { ANIMATION_OPTIONS, mergeNested } from './inspector/shared';

const FONT_WEIGHT_OPTIONS = [
  { label: 'Regular (400)', value: '400' },
  { label: 'Medium (500)', value: '500' },
  { label: 'Semibold (600)', value: '600' },
  { label: 'Bold (700)', value: '700' },
  { label: 'Extra Bold (800)', value: '800' },
];

const SHADOW_OPTIONS = [
  { label: 'None', value: 'none' },
  { label: 'Soft', value: 'sm' },
  { label: 'Medium', value: 'md' },
  { label: 'Large', value: 'lg' },
];

type ButtonInspectorProps = {
  block: ButtonBlock;
  onChange: (patch: Partial<ButtonBlock>) => void;
};

const ButtonInspector: React.FC<ButtonInspectorProps> = ({ block, onChange }) => {
  const typography = block.typography ?? {};
  const spacing = block.spacing ?? {};
  const animation = block.animation ?? {};

  const fontValue = useMemo(() => normalizeFontFamily(typography.fontFamily) ?? 'default', [typography.fontFamily]);

  const updateTypography = useCallback(
    (patch: Partial<NonNullable<ButtonBlock['typography']>>) => {
      const next = mergeNested(block.typography, patch);
      onChange({ typography: next });
    },
    [block.typography, onChange],
  );

  const handleSpacingChange = useCallback(
    (key: keyof NonNullable<ButtonBlock['spacing']>, value: number | undefined) => {
      const next = mergeNested(block.spacing, { [key]: value });
      onChange({ spacing: next });
    },
    [block.spacing, onChange],
  );

  const updateAnimation = useCallback(
    (patch: Partial<NonNullable<ButtonBlock['animation']>>) => {
      const next = mergeNested(block.animation, patch);
      onChange({ animation: next });
    },
    [block.animation, onChange],
  );

  return (
    <InspectorContainer>
      <InspectorGroup title="Basic">
        <InspectorSection title="Content">
          <InputText
            label="Label"
            value={block.label}
            onChange={(value) => onChange({ label: value })}
            placeholder="Call to action"
          />
          <InputText
            label="Link URL"
            value={block.href ?? ''}
            onChange={(value) => onChange({ href: value })}
            placeholder="https://"
          />
          <InputToggle
            label="Open in new tab"
            checked={block.target === '_blank'}
            onChange={(checked) => onChange({ target: checked ? '_blank' : '_self' })}
          />
        </InspectorSection>

        <InspectorSection title="Appearance">
          <InputSelect
            label="Style"
            value={block.style ?? 'primary'}
            onChange={(value) => onChange({ style: value as ButtonBlock['style'] })}
            options={[
              { label: 'Primary', value: 'primary' },
              { label: 'Outline', value: 'outline' },
            ]}
          />
          <InputColor
            label="Text color"
            value={block.textColor ?? '#ffffff'}
            onChange={(value) => onChange({ textColor: value })}
          />
          <InputColor
            label="Background color"
            value={block.backgroundColor ?? '#059669'}
            onChange={(value) => onChange({ backgroundColor: value })}
          />
          <InputColor
            label="Border color"
            value={block.borderColor ?? (block.style === 'outline' ? '#059669' : block.backgroundColor ?? '#059669')}
            onChange={(value) => onChange({ borderColor: value })}
          />
        </InspectorSection>

        <InspectorSection title="Typography">
          <ControlRow label="Font family">
            <FontSelect
              value={fontValue}
              onChange={(value) => updateTypography({ fontFamily: normalizeFontFamily(value) ?? 'default' })}
            />
          </ControlRow>
          <InputSelect
            label="Font weight"
            value={String(typography.fontWeight ?? tokens.fontWeight.medium)}
            onChange={(value) => updateTypography({ fontWeight: Number.parseInt(value, 10) || tokens.fontWeight.medium })}
            options={FONT_WEIGHT_OPTIONS}
          />
          <InputSlider
            label="Font size (px)"
            value={typography.fontSize}
            fallbackValue={tokens.fontSize.md}
            min={12}
            max={48}
            step={1}
            onChange={(value) => updateTypography({ fontSize: value })}
          />
          <InputSlider
            label="Letter spacing (px)"
            value={typography.letterSpacing}
            fallbackValue={0}
            min={-4}
            max={8}
            step={0.1}
            onChange={(value) => updateTypography({ letterSpacing: value })}
          />
          <InputSlider
            label="Line height"
            value={typography.lineHeight}
            fallbackValue={tokens.lineHeight.normal}
            min={1}
            max={2}
            step={0.05}
            formatValue={(value, fallback) => {
              const resolved = typeof value === 'number' ? value : fallback;
              return resolved.toFixed(2);
            }}
            onChange={(value) => updateTypography({ lineHeight: value })}
          />
          <InputToggle
            label="Uppercase"
            checked={Boolean(typography.uppercase)}
            onChange={(checked) => updateTypography({ uppercase: checked })}
          />
          <InputToggle
            label="Italic"
            checked={Boolean(typography.italic)}
            onChange={(checked) => updateTypography({ italic: checked })}
          />
          <InputToggle
            label="Underline"
            checked={Boolean(typography.underline)}
            onChange={(checked) => updateTypography({ underline: checked })}
          />
        </InspectorSection>

        <InspectorSection title="Alignment">
          <AlignmentControl value={block.align ?? 'left'} onChange={(align) => onChange({ align })} />
        </InspectorSection>
      </InspectorGroup>

      <InspectorGroup title="Advanced" collapsible defaultExpanded={false}>
        <InspectorSection title="Spacing">
          <InputSlider
            label="Margin top"
            value={spacing.marginTop}
            fallbackValue={0}
            min={0}
            max={120}
            onChange={(value) => handleSpacingChange('marginTop', value)}
          />
          <InputSlider
            label="Margin right"
            value={spacing.marginRight}
            fallbackValue={0}
            min={0}
            max={120}
            onChange={(value) => handleSpacingChange('marginRight', value)}
          />
          <InputSlider
            label="Margin bottom"
            value={spacing.marginBottom}
            fallbackValue={tokens.spacing.md}
            min={0}
            max={120}
            onChange={(value) => handleSpacingChange('marginBottom', value)}
          />
          <InputSlider
            label="Margin left"
            value={spacing.marginLeft}
            fallbackValue={0}
            min={0}
            max={120}
            onChange={(value) => handleSpacingChange('marginLeft', value)}
          />
          <InputSlider
            label="Padding top"
            value={spacing.paddingTop}
            fallbackValue={tokens.spacing.sm}
            min={0}
            max={80}
            onChange={(value) => handleSpacingChange('paddingTop', value)}
          />
          <InputSlider
            label="Padding right"
            value={spacing.paddingRight}
            fallbackValue={tokens.spacing.lg}
            min={0}
            max={160}
            onChange={(value) => handleSpacingChange('paddingRight', value)}
          />
          <InputSlider
            label="Padding bottom"
            value={spacing.paddingBottom}
            fallbackValue={tokens.spacing.sm}
            min={0}
            max={80}
            onChange={(value) => handleSpacingChange('paddingBottom', value)}
          />
          <InputSlider
            label="Padding left"
            value={spacing.paddingLeft}
            fallbackValue={tokens.spacing.lg}
            min={0}
            max={160}
            onChange={(value) => handleSpacingChange('paddingLeft', value)}
          />
        </InspectorSection>

        <InspectorSection title="Corners & shadow">
          <InputSlider
            label="Radius (px)"
            value={block.radius}
            fallbackValue={tokens.radius.lg}
            min={0}
            max={96}
            onChange={(value) => onChange({ radius: value })}
          />
          <InputSelect
            label="Shadow"
            value={block.shadow ?? 'none'}
            onChange={(value) => onChange({ shadow: value as NonNullable<ButtonBlock['shadow']> })}
            options={SHADOW_OPTIONS}
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

export default ButtonInspector;
