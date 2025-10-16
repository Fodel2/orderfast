import React, { useCallback } from 'react';

import InspectorSection, {
  InspectorContainer,
  InspectorGroup,
} from '@/src/components/inspector/InspectorSection';
import InputColor from '@/src/components/inspector/controls/InputColor';
import InputSelect from '@/src/components/inspector/controls/InputSelect';
import InputSlider from '@/src/components/inspector/controls/InputSlider';
import InputToggle from '@/src/components/inspector/controls/InputToggle';

import type { SpacerBlock, TextAnimationType } from '../PageRenderer';
import { ANIMATION_OPTIONS, mergeNested } from './inspector/shared';

const BACKGROUND_OPTIONS = [
  { label: 'None', value: 'none' },
  { label: 'Solid color', value: 'color' },
];

type SpacerInspectorProps = {
  block: SpacerBlock;
  onChange: (patch: Partial<SpacerBlock>) => void;
};

const SpacerInspector: React.FC<SpacerInspectorProps> = ({ block, onChange }) => {
  const spacing = block.spacing ?? {};
  const background = block.background ?? { mode: 'none', type: 'none' };
  const animation = block.animation ?? {};

  const updateSpacing = useCallback(
    (patch: Partial<NonNullable<SpacerBlock['spacing']>>) => {
      const next = mergeNested(block.spacing, patch);
      onChange({ spacing: next });
    },
    [block.spacing, onChange],
  );

  const handleSpacingChange = useCallback(
    (key: keyof NonNullable<SpacerBlock['spacing']>, value: number | undefined) => {
      updateSpacing({ [key]: value } as Partial<NonNullable<SpacerBlock['spacing']>>);
    },
    [updateSpacing],
  );

  const updateBackground = useCallback(
    (patch: Partial<NonNullable<SpacerBlock['background']>>) => {
      const next = mergeNested(block.background, patch);
      onChange({ background: next });
    },
    [block.background, onChange],
  );

  const updateAnimation = useCallback(
    (patch: Partial<NonNullable<SpacerBlock['animation']>>) => {
      const next = mergeNested(block.animation, patch);
      onChange({ animation: next });
    },
    [block.animation, onChange],
  );

  return (
    <InspectorContainer>
      <InspectorGroup title="Basic">
        <InspectorSection title="Layout">
          <InputSlider
            label="Height (px)"
            value={block.height}
            fallbackValue={64}
            min={8}
            max={320}
            step={4}
            onChange={(value) => onChange({ height: value })}
          />
        </InspectorSection>
      </InspectorGroup>

      <InspectorGroup title="Advanced" collapsible defaultExpanded={false}>
        <InspectorSection title="Spacing">
          <InputSlider
            label="Margin top"
            value={spacing.marginTop}
            fallbackValue={0}
            min={0}
            max={200}
            onChange={(value) => handleSpacingChange('marginTop', value)}
          />
          <InputSlider
            label="Margin right"
            value={spacing.marginRight}
            fallbackValue={0}
            min={0}
            max={200}
            onChange={(value) => handleSpacingChange('marginRight', value)}
          />
          <InputSlider
            label="Margin bottom"
            value={spacing.marginBottom}
            fallbackValue={block.height ?? 64}
            min={0}
            max={200}
            onChange={(value) => handleSpacingChange('marginBottom', value)}
          />
          <InputSlider
            label="Margin left"
            value={spacing.marginLeft}
            fallbackValue={0}
            min={0}
            max={200}
            onChange={(value) => handleSpacingChange('marginLeft', value)}
          />
          <InputSlider
            label="Padding top"
            value={spacing.paddingTop}
            fallbackValue={0}
            min={0}
            max={160}
            onChange={(value) => handleSpacingChange('paddingTop', value)}
          />
          <InputSlider
            label="Padding right"
            value={spacing.paddingRight}
            fallbackValue={0}
            min={0}
            max={160}
            onChange={(value) => handleSpacingChange('paddingRight', value)}
          />
          <InputSlider
            label="Padding bottom"
            value={spacing.paddingBottom}
            fallbackValue={0}
            min={0}
            max={160}
            onChange={(value) => handleSpacingChange('paddingBottom', value)}
          />
          <InputSlider
            label="Padding left"
            value={spacing.paddingLeft}
            fallbackValue={0}
            min={0}
            max={160}
            onChange={(value) => handleSpacingChange('paddingLeft', value)}
          />
        </InspectorSection>

        <InspectorSection title="Background">
          <InputSelect
            label="Mode"
            value={background.mode ?? 'none'}
            onChange={(value) => updateBackground({ mode: value as 'none' | 'color', type: value as 'none' | 'color' })}
            options={BACKGROUND_OPTIONS}
          />
          {background.mode === 'color' ? (
            <InputColor
              label="Background color"
              value={background.color ?? '#f1f5f9'}
              onChange={(value) => updateBackground({ color: value })}
            />
          ) : null}
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

export default SpacerInspector;
