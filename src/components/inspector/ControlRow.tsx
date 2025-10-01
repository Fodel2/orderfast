import { ReactNode } from "react";

import { inspectorColors, inspectorLayout } from "./layout";

const { labelWidth, gap, paddingX, paddingY } = inspectorLayout;

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

        @media (max-width: 640px) {
          .inspector-row {
            grid-template-columns: 1fr;
          }

          .inspector-control {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

export default ControlRow;
