import React from 'react';

import ControlRow from '@/src/components/inspector/ControlRow';
import { tokens } from '@/src/ui/tokens';

import { ALIGN_OPTIONS } from './shared';

type AlignmentControlProps = {
  value: 'left' | 'center' | 'right';
  onChange: (value: 'left' | 'center' | 'right') => void;
};

const AlignmentControl: React.FC<AlignmentControlProps> = ({ value, onChange }) => (
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

export default AlignmentControl;
