import { ChangeEvent, forwardRef, useCallback, useId, useMemo, useRef } from "react";

import ControlRow from "../ControlRow";
import { inspectorColors, inspectorLayout } from "../layout";
import { tokens } from "../../../ui/tokens";

const {
  controlHeight,
  radius,
  borderWidth,
  gap,
  mobileBreakpoint,
} = inspectorLayout;
const UPLOAD_FOCUS_RING = `var(--inspector-upload-focus-ring, ${tokens.colors.focusRing})`;
const UPLOAD_HOVER_BORDER = `var(--inspector-upload-hover-border, ${tokens.colors.neutral[400]})`;

export interface InputUploadProps {
  id?: string;
  label: string;
  buttonLabel: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  uploading?: boolean;
  uploadingLabel?: string;
  onSelectFiles: (files: FileList | null) => void;
}

const InputUpload = forwardRef<HTMLInputElement, InputUploadProps>(
  (
    {
      id,
      label,
      buttonLabel,
      accept,
      multiple = false,
      disabled = false,
      uploading = false,
      uploadingLabel = "Uploading…",
      onSelectFiles,
    },
    forwardedRef,
  ) => {
    const localRef = useRef<HTMLInputElement | null>(null);

    const generatedId = useId();
    const inputId = useMemo(() => {
      if (id) return id;
      const normalizedLabel = label.replace(/\s+/g, "-").toLowerCase();
      return `upload-${normalizedLabel}-${generatedId}`;
    }, [generatedId, id, label]);

    const setRefs = useCallback(
      (node: HTMLInputElement | null) => {
        localRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    const handleButtonClick = () => {
      if (disabled) return;
      localRef.current?.click();
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
      onSelectFiles(event.target.files);
      event.target.value = "";
    };

    return (
      <>
        <ControlRow label={label} htmlFor={inputId}>
          <div className="upload-control">
            <input
              ref={setRefs}
              id={inputId}
              className="upload-input"
              type="file"
              accept={accept}
              multiple={multiple}
              disabled={disabled}
              onChange={handleFileChange}
            />
            <button
              type="button"
              className="upload-button"
              onClick={handleButtonClick}
              disabled={disabled}
            >
              {buttonLabel}
            </button>
            {uploading ? (
              <span className="upload-status">{uploadingLabel}</span>
            ) : null}
          </div>
        </ControlRow>
        <style jsx>{`
          .upload-control {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: ${gap}px;
            width: 100%;
          }

          .upload-input {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            border: 0;
          }

          .upload-button {
            height: ${controlHeight}px;
            border-radius: ${radius}px;
            border: ${borderWidth}px solid ${inspectorColors.border};
            background-color: ${inspectorColors.background};
            color: ${inspectorColors.text};
            padding: 0 ${tokens.spacing.md}px;
            font-size: 0.875rem;
            font-weight: 500;
            transition: border-color 0.15s ease, box-shadow 0.15s ease;
            cursor: pointer;
          }

          .upload-button:hover:not(:disabled) {
            border-color: ${UPLOAD_HOVER_BORDER};
          }

          .upload-button:focus-visible {
            outline: ${tokens.border.thick}px solid ${UPLOAD_FOCUS_RING};
            outline-offset: 2px;
            border-color: ${UPLOAD_FOCUS_RING};
          }

          .upload-button:disabled {
            opacity: ${tokens.opacity[50]};
            cursor: not-allowed;
          }

          .upload-status {
            font-size: 0.75rem;
            color: ${inspectorColors.label};
          }

          @media (max-width: ${mobileBreakpoint}px) {
            .upload-control {
              justify-content: flex-start;
            }
          }
        `}</style>
      </>
    );
  },
);

InputUpload.displayName = "InputUpload";

export default InputUpload;
