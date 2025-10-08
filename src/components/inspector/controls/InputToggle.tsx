import ControlRow from "../ControlRow";
import { inspectorColors, inspectorLayout } from "../layout";
import { tokens } from "../../../ui/tokens";

const { controlHeight, borderWidth } = inspectorLayout;
const togglePadding = tokens.spacing.xs;
const toggleWidth = controlHeight * 1.75;
const knobSize = controlHeight - togglePadding * 2;
const knobTranslate = toggleWidth - knobSize - togglePadding * 2;
const TOGGLE_ACCENT = `var(--inspector-toggle-accent, ${tokens.colors.accent})`;
const TOGGLE_ACCENT_ACTIVE = `var(--inspector-toggle-accent-active, ${tokens.colors.accentStrong})`;
const TOGGLE_FOCUS_RING = `var(--inspector-toggle-focus-ring, ${tokens.colors.focusRing})`;
const TOGGLE_HOVER_BORDER = `var(--inspector-toggle-hover-border, ${tokens.colors.neutral[400]})`;
const TOGGLE_KNOB_COLOR = `var(--inspector-toggle-knob, ${tokens.colors.neutral[300]})`;
const TOGGLE_KNOB_CHECKED = `var(--inspector-toggle-knob-checked, ${tokens.colors.surface})`;

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
          transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .inspector-toggle:focus-visible {
          outline: ${tokens.border.thick}px solid ${TOGGLE_FOCUS_RING};
          outline-offset: 2px;
          border-color: ${TOGGLE_FOCUS_RING};
          box-shadow: 0 0 0 4px ${tokens.colors.surfaceHover};
        }

        .inspector-toggle:hover:not(:disabled) {
          border-color: ${TOGGLE_HOVER_BORDER};
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
          background-color: ${TOGGLE_KNOB_COLOR};
          transition: transform 0.2s ease, background-color 0.2s ease;
        }

        .inspector-toggle.is-checked {
          background-color: ${TOGGLE_ACCENT};
          border-color: ${TOGGLE_ACCENT};
        }

        .inspector-toggle.is-checked .inspector-toggle-knob {
          transform: translateX(${knobTranslate}px);
          background-color: ${TOGGLE_KNOB_CHECKED};
        }

        .inspector-toggle.is-checked:hover:not(:disabled) {
          background-color: ${TOGGLE_ACCENT_ACTIVE};
          border-color: ${TOGGLE_ACCENT_ACTIVE};
        }
      `}</style>
    </>
  );
}

export default InputToggle;
