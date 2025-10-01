import { ChangeEvent, ReactNode } from "react";

import ControlRow from "../ControlRow";
import { inspectorColors, inspectorLayout } from "../layout";
import { tokens } from "../../../ui/tokens";

const { controlHeight, radius, borderWidth, mobileBreakpoint } = inspectorLayout;

export interface InputTextProps {
  id?: string;
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function InputText({
  id,
  label,
  value,
  type = "text",
  placeholder,
  disabled = false,
  onChange,
  leading,
  trailing,
}: InputTextProps) {
  const inputId = id ?? `text-${label.replace(/\s+/g, "-").toLowerCase()}`;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <>
      <ControlRow label={label} htmlFor={inputId}>
        <div className="inspector-text-wrapper">
          {leading ? <span className="inspector-text-leading">{leading}</span> : null}
          <input
            id={inputId}
            className="inspector-text-input"
            type={type}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onChange={handleChange}
          />
          {trailing ? (
            <span className="inspector-text-trailing">{trailing}</span>
          ) : null}
        </div>
      </ControlRow>
      <style jsx>{`
        .inspector-text-wrapper {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: ${tokens.spacing.sm}px;
          width: 100%;
          flex-wrap: wrap;
        }

        .inspector-text-input {
          width: 100%;
          flex: 1;
          min-width: 0;
          height: ${controlHeight}px;
          border-radius: ${radius}px;
          border: ${borderWidth}px solid ${inspectorColors.border};
          padding: 0 ${tokens.spacing.sm}px;
          font-size: 0.875rem;
          color: ${inspectorColors.text};
          background-color: ${inspectorColors.background};
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .inspector-text-input::placeholder {
          color: ${inspectorColors.labelMuted};
        }

        .inspector-text-input:focus-visible {
          outline: 2px solid #10b981;
          outline-offset: 2px;
        }

        .inspector-text-input:disabled {
          opacity: ${tokens.opacity[50]};
          cursor: not-allowed;
        }

        .inspector-text-leading,
        .inspector-text-trailing {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: ${tokens.spacing.xs}px;
          flex-shrink: 0;
        }

        @media (max-width: ${mobileBreakpoint}px) {
          .inspector-text-input {
            width: 100%;
          }

          .inspector-text-wrapper {
            justify-content: flex-start;
          }
        }
      `}</style>
    </>
  );
}

export default InputText;
