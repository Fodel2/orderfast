import { HTMLAttributes, ReactNode } from "react";

import { tokens } from "../../ui/tokens";

const SECTION_GAP = tokens.spacing.sm;
const SECTION_PADDING = tokens.spacing.md;
const SECTION_RADIUS = tokens.radius.md;
const SECTION_BORDER_WIDTH = tokens.border.thin;
const SECTION_SHADOW = tokens.shadow.sm;
const CONTAINER_GAP = tokens.spacing.lg;
const CONTAINER_PADDING = tokens.spacing.lg;

interface InspectorSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

interface InspectorContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function InspectorContainer({
  children,
  className,
  style,
  ...rest
}: InspectorContainerProps) {
  const mergedClassName = ["inspector-container", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={mergedClassName}
      style={{
        ...style,
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        maxHeight: "100vh",
      }}
      {...rest}
    >
      {children}

      <style jsx>{`
        .inspector-container {
          gap: ${CONTAINER_GAP}px;
          padding: ${CONTAINER_PADDING}px;
          overflow-y: auto;
          overscroll-behavior: contain;
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
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
          background-color: ${tokens.colors.surface};
          border-radius: ${SECTION_RADIUS}px;
          border: ${SECTION_BORDER_WIDTH}px solid ${tokens.colors.borderLight};
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
          color: ${tokens.colors.textPrimary};
        }

        .inspector-description {
          margin: 0;
          font-size: 0.75rem;
          color: ${tokens.colors.textMuted};
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
