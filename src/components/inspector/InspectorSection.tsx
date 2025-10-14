import { HTMLAttributes, ReactNode, useMemo, useState } from "react";

import { tokens } from "../../ui/tokens";

const SECTION_GAP = tokens.spacing.sm;
const SECTION_PADDING = tokens.spacing.md;
const SECTION_RADIUS = tokens.radius.md;
const SECTION_BORDER_WIDTH = tokens.border.thin;
const SECTION_SHADOW = tokens.shadow.sm;
const CONTAINER_GAP = tokens.spacing.md;
const CONTAINER_PADDING = tokens.spacing.md;

interface InspectorSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

interface InspectorGroupProps {
  title: string;
  description?: string;
  children: ReactNode;
  /**
   * When true the group can be expanded/collapsed via a toggle button.
   * This enables the "Show Advanced" affordance requested by design without
   * altering the default layout of the inspector.
   */
  collapsible?: boolean;
  /**
   * Controls the initial open state when the group is collapsible.
   */
  defaultExpanded?: boolean;
  /**
   * Optional action rendered next to the toggle button.
   */
  action?: ReactNode;
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

export function InspectorGroup({
  title,
  description,
  children,
  collapsible = false,
  defaultExpanded = true,
  action,
}: InspectorGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const resolvedExpanded = collapsible ? expanded : true;
  const toggleLabel = useMemo(() => {
    if (!collapsible) return null;
    return resolvedExpanded ? "Hide Advanced" : "Show Advanced";
  }, [collapsible, resolvedExpanded]);

  return (
    <section className="inspector-group" data-collapsible={collapsible}>
      <header className="inspector-group__header">
        <div className="inspector-group__meta">
          <h2 className="inspector-group__title">{title}</h2>
          {description ? (
            <p className="inspector-group__description">{description}</p>
          ) : null}
        </div>
        <div className="inspector-group__actions">
          {action}
          {collapsible ? (
            <button
              type="button"
              className="inspector-group__toggle"
              onClick={() => setExpanded((current) => !current)}
            >
              {toggleLabel}
            </button>
          ) : null}
        </div>
      </header>
      {resolvedExpanded ? <div className="inspector-group__content">{children}</div> : null}

      <style jsx>{`
        .inspector-group {
          display: flex;
          flex-direction: column;
          gap: ${CONTAINER_GAP}px;
          padding: ${CONTAINER_PADDING}px 0;
          border-bottom: ${tokens.border.thin}px solid ${tokens.colors.borderLight};
        }

        .inspector-group:last-of-type {
          border-bottom: none;
          padding-bottom: 0;
        }

        .inspector-group__header {
          display: flex;
          flex-direction: column;
          gap: ${tokens.spacing.xs}px;
        }

        .inspector-group__meta {
          display: flex;
          flex-direction: column;
          gap: ${tokens.spacing.xs}px;
        }

        .inspector-group__title {
          margin: 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: ${tokens.colors.textPrimary};
        }

        .inspector-group__description {
          margin: 0;
          font-size: 0.75rem;
          color: ${tokens.colors.textMuted};
        }

        .inspector-group__actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: ${tokens.spacing.xs}px;
        }

        .inspector-group__toggle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: ${tokens.spacing.xs}px ${tokens.spacing.sm}px;
          border-radius: ${tokens.radius.sm}px;
          border: ${tokens.border.thin}px solid ${tokens.colors.borderLight};
          background: ${tokens.colors.surface};
          color: ${tokens.colors.textSecondary};
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s ease, border-color 0.2s ease,
            color 0.2s ease;
        }

        .inspector-group__toggle:hover {
          background: ${tokens.colors.surfaceMuted};
          border-color: ${tokens.colors.borderStrong};
        }

        .inspector-group__content {
          display: flex;
          flex-direction: column;
          gap: ${CONTAINER_GAP}px;
        }

        @media (min-width: 768px) {
          .inspector-group__header {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
        }
      `}</style>
    </section>
  );
}

export default InspectorSection;
