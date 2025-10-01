import { ReactNode } from "react";

import { tokens } from "../../ui/tokens";

const SECTION_GAP = tokens.spacing.sm;
const SECTION_PADDING = tokens.spacing.md;
const SECTION_RADIUS = tokens.radius.md;
const SECTION_BORDER_WIDTH = tokens.border.thin;
const SECTION_SHADOW = tokens.shadow.sm;

interface InspectorSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function InspectorSection({ title, description, children }: InspectorSectionProps) {
  return (
    <section className="inspector-section">
      <header className="inspector-header">
        <h2 className="inspector-title">{title}</h2>
        {description ? (
          <p className="inspector-description">{description}</p>
        ) : null}
      </header>
      <div className="inspector-content">{children}</div>

      <style jsx>{`
        .inspector-section {
          background-color: #ffffff;
          border-radius: ${SECTION_RADIUS}px;
          border: ${SECTION_BORDER_WIDTH}px solid rgba(15, 23, 42, 0.08);
          box-shadow: ${SECTION_SHADOW};
          padding: ${SECTION_PADDING}px;
          display: flex;
          flex-direction: column;
          gap: ${SECTION_GAP}px;
        }

        .inspector-header {
          display: flex;
          flex-direction: column;
          gap: ${tokens.spacing.xs}px;
        }

        .inspector-title {
          margin: 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: #0f172a;
        }

        .inspector-description {
          margin: 0;
          font-size: 0.75rem;
          color: #64748b;
          line-height: 1.4;
        }

        .inspector-content {
          display: flex;
          flex-direction: column;
          gap: ${SECTION_GAP}px;
        }
      `}</style>
    </section>
  );
}

export default InspectorSection;
