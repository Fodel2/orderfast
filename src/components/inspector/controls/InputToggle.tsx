import ControlRow from "../ControlRow";
import { inspectorColors, inspectorLayout } from "../layout";
import { tokens } from "../../../ui/tokens";

const { controlHeight, borderWidth } = inspectorLayout;
const togglePadding = tokens.spacing.xs;
const toggleWidth = controlHeight * 1.75;
const knobSize = controlHeight - togglePadding * 2;
const knobTranslate = toggleWidth - knobSize - togglePadding * 2;

export interface InputToggleProps {
  id?: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export function InputToggle({
  id,
  label,
  checked,
  disabled = false,
  onChange,
}: InputToggleProps) {
  const inputId = id ?? `toggle-${label.replace(/\s+/g, "-").toLowerCase()}`;

  const handleToggle = () => {
    if (disabled) return;
    onChange(!checked);
  };

  return (
    <>
      <ControlRow label={label} htmlFor={inputId}>
        <div className="toggle-wrapper">
          <button
            id={inputId}
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            className={`inspector-toggle${checked ? " is-checked" : ""}`}
            onClick={handleToggle}
          >
            <span className="inspector-toggle-knob" />
          </button>
        </div>
      </ControlRow>
      <style jsx>{`
        .toggle-wrapper {
          display: flex;
          justify-content: flex-end;
          width: 100%;
        }

        .inspector-toggle {
          position: relative;
          width: ${toggleWidth}px;
          height: ${controlHeight}px;
          padding: 0 ${togglePadding}px;
          border-radius: ${controlHeight}px;
          border: ${borderWidth}px solid ${inspectorColors.border};
          background-color: ${inspectorColors.background};
          display: inline-flex;
          align-items: center;
          transition: background-color 0.2s ease, border-color 0.2s ease;
        }

        .inspector-toggle:focus-visible {
          outline: 2px solid #10b981;
          outline-offset: 2px;
        }

        .inspector-toggle:disabled {
          opacity: ${tokens.opacity[50]};
          cursor: not-allowed;
        }

        .inspector-toggle-knob {
          position: absolute;
          top: ${togglePadding}px;
          left: ${togglePadding}px;
          width: ${knobSize}px;
          height: ${knobSize}px;
          border-radius: ${controlHeight}px;
          background-color: ${inspectorColors.border};
          transition: transform 0.2s ease, background-color 0.2s ease;
        }

        .inspector-toggle.is-checked {
          background-color: #10b981;
          border-color: #10b981;
        }

        .inspector-toggle.is-checked .inspector-toggle-knob {
          transform: translateX(${knobTranslate}px);
          background-color: #ffffff;
        }
      `}</style>
    </>
  );
}

export default InputToggle;
