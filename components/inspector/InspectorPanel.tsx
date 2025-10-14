import React from 'react';
import clsx from 'clsx';

import styles from './InspectorPanel.module.css';

type InspectorPanelProps = {
  open: boolean;
  className?: string;
  title?: string;
  subtitle?: string;
  onClose?: () => void;
  header?: React.ReactNode;
  bodyClassName?: string;
  bodyStyle?: React.CSSProperties;
  contentClassName?: string;
  contentStyle?: React.CSSProperties;
  children: React.ReactNode;
};

const InspectorPanel: React.FC<InspectorPanelProps> = ({
  open,
  className,
  title,
  subtitle,
  onClose,
  header,
  bodyClassName,
  bodyStyle,
  contentClassName,
  contentStyle,
  children,
}) => {
  const panelClassName = clsx(
    styles.panel,
    open && styles.open,
    className,
    'inspector-panel',
  );

  return (
    <aside className={panelClassName} aria-hidden={!open} role="complementary">
      <div className={clsx(styles.content, contentClassName)} style={contentStyle}>
        {header ??
          (title ? (
            <div className={styles.header}>
              <div className={styles.titles}>
                <span className={styles.title}>{title}</span>
                {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
              </div>
              {onClose ? (
                <button type="button" className={styles.closeButton} onClick={onClose}>
                  Close
                </button>
              ) : null}
            </div>
          ) : null)}
        <div className={clsx(styles.body, bodyClassName)} style={bodyStyle}>
          {children}
        </div>
      </div>
    </aside>
  );
};

export default InspectorPanel;
