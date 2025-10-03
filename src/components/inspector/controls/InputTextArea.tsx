import { ChangeEvent } from "react";

import ControlRow from "../ControlRow";
import { inspectorColors, inspectorLayout } from "../layout";
import { tokens } from "../../../ui/tokens";

const { controlHeight, radius, borderWidth, mobileBreakpoint } = inspectorLayout;

export interface InputTextAreaProps {
  id?: string;
  label: string;
  value: string;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function InputTextArea({
  id,
  label,
  value,
  rows = 3,
  placeholder,
  disabled = false,
  onChange,
}: InputTextAreaProps) {
  const inputId = id ?? `textarea-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const resolvedRows = Math.max(rows, 2);
  const minHeight = resolvedRows * controlHeight;

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  return (
    <>
      <ControlRow label={label} htmlFor={inputId}>
        <textarea
          id={inputId}
          className="inspector-textarea"
          value={value}
          onChange={handleChange}
          rows={rows}
          placeholder={placeholder}
          disabled={disabled}
        />
      </ControlRow>
      <style jsx>{`
        .inspector-textarea {
          width: 100%;
          min-height: ${minHeight}px;
          border-radius: ${radius}px;
          border: ${borderWidth}px solid ${inspectorColors.border};
          padding: ${tokens.spacing.sm}px;
          font-size: 0.875rem;
          line-height: 1.45;
          color: ${inspectorColors.text};
          background-color: ${inspectorColors.background};
          resize: vertical;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .inspector-textarea::placeholder {
          color: ${inspectorColors.labelMuted};
        }

        .inspector-textarea:focus-visible {
          outline: 2px solid #10b981;
          outline-offset: 2px;
        }

        .inspector-textarea:disabled {
          opacity: ${tokens.opacity[50]};
          cursor: not-allowed;
        }

        @media (max-width: ${mobileBreakpoint}px) {
          .inspector-textarea {
            min-height: ${minHeight}px;
          }
        }
      `}</style>
    </>
  );
}

export default InputTextArea;
