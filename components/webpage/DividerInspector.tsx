import React, { useCallback } from 'react';

import InspectorSection, {
  InspectorContainer,
  InspectorGroup,
} from '@/src/components/inspector/InspectorSection';
import InputColor from '@/src/components/inspector/controls/InputColor';
import InputSelect from '@/src/components/inspector/controls/InputSelect';
import InputSlider from '@/src/components/inspector/controls/InputSlider';
import InputToggle from '@/src/components/inspector/controls/InputToggle';

import type { DividerBlock, TextAnimationType } from '../PageRenderer';
import { ANIMATION_OPTIONS, mergeNested } from './inspector/shared';

type DividerInspectorProps = {
  block: DividerBlock;
  onChange: (patch: Partial<DividerBlock>) => void;
};

const DividerInspector: React.FC<DividerInspectorProps> = ({ block, onChange }) => {
  const spacing = block.spacing ?? {};
  const animation = block.animation ?? {};

  const updateSpacing = useCallback(
    (patch: Partial<NonNullable<DividerBlock['spacing']>>) => {
      const next = mergeNested(block.spacing, patch);
      onChange({ spacing: next });
    },
    [block.spacing, onChange],
  );

  const handleSpacingChange = useCallback(
    (key: keyof NonNullable<DividerBlock['spacing']>, value: number | undefined) => {
      updateSpacing({ [key]: value } as Partial<NonNullable<DividerBlock['spacing']>>);
    },
    [updateSpacing],
  );

  const updateAnimation = useCallback(
    (patch: Partial<NonNullable<DividerBlock['animation']>>) => {
      const next = mergeNested(block.animation, patch);
      onChange({ animation: next });
    },
    [block.animation, onChange],
  );

  return (
    <InspectorContainer>
      <InspectorGroup title="Basic">
        <InspectorSection title="Line">
          <InputSlider
            label="Thickness (px)"
            value={block.thickness}
            fallbackValue={2}
            min={1}
            max={12}
            onChange={(value) => onChange({ thickness: value })}
          />
          <InputColor
            label="Color"
            value={block.color ?? '#cbd5f5'}
            onChange={(value) => onChange({ color: value })}
          />
        </InspectorSection>
      </InspectorGroup>

      <InspectorGroup title="Advanced" collapsible defaultExpanded={false}>
        <InspectorSection title="Spacing">
          <InputSlider
            label="Margin top"
            value={spacing.marginTop}
            fallbackValue={24}
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
            fallbackValue={24}
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
            max={120}
            onChange={(value) => handleSpacingChange('paddingTop', value)}
          />
          <InputSlider
            label="Padding right"
            value={spacing.paddingRight}
            fallbackValue={0}
            min={0}
            max={120}
            onChange={(value) => handleSpacingChange('paddingRight', value)}
          />
          <InputSlider
            label="Padding bottom"
            value={spacing.paddingBottom}
            fallbackValue={0}
            min={0}
            max={120}
            onChange={(value) => handleSpacingChange('paddingBottom', value)}
          />
          <InputSlider
            label="Padding left"
            value={spacing.paddingLeft}
            fallbackValue={0}
            min={0}
            max={120}
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

export default DividerInspector;
