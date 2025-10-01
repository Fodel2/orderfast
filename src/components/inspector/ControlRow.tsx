import { ReactNode } from "react";

import { inspectorColors, inspectorLayout } from "./layout";

const { labelWidth, gap, paddingX, paddingY, controlHeight, mobileBreakpoint } = inspectorLayout;

interface ControlRowProps {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}

export function ControlRow({ label, htmlFor, children }: ControlRowProps) {
  return (
    <div className="inspector-row">
      <label className="inspector-label" htmlFor={htmlFor}>
        {label}
      </label>
      <div className="inspector-control">{children}</div>

      <style jsx>{`
        .inspector-row {
          display: grid;
          grid-template-columns: ${labelWidth}px 1fr;
          align-items: center;
          gap: ${gap}px;
          padding: ${paddingY}px ${paddingX}px;
        }

        .inspector-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: ${inspectorColors.label};
          line-height: 1.2;
          display: flex;
          align-items: center;
          min-height: ${controlHeight}px;
        }

        .inspector-control {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: ${gap}px;
          min-width: 0;
        }

        .inspector-control :global(*) {
          width: 100%;
        }

        @media (max-width: ${mobileBreakpoint}px) {
          .inspector-row {
            grid-template-columns: 1fr;
          }

          .inspector-control {
            width: 100%;
            justify-content: stretch;
          }

          .inspector-label {
            min-height: auto;
          }
        }
      `}</style>
    </div>
  );
}

export default ControlRow;
