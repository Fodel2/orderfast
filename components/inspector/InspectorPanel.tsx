import React from 'react';
import clsx from 'clsx';

import styles from './InspectorPanel.module.css';
import { useIsMobile } from '@/src/hooks/useIsMobile';

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
  const isMobile = useIsMobile(768);
  const panelClassName = clsx(
    styles.panel,
    open ? styles.open : styles.closed,
    className,
    'inspector-panel',
  );

  return (
    <aside className={panelClassName} aria-hidden={!open} role="complementary">
      {isMobile && onClose ? (
        <button
          type="button"
          className={clsx(styles.mobileCloseButton, 'inspector-close')}
          onClick={onClose}
          aria-label="Close inspector"
        >
          ✕
        </button>
      ) : null}
      <div
        className={clsx(styles.content, 'inspector-panel__content', contentClassName)}
        style={contentStyle}
      >
        {header ??
          (title ? (
            <div className={clsx(styles.header, 'inspector-panel__header')}>
              <div className={clsx(styles.titles, 'inspector-panel__titles')}>
                <span className={clsx(styles.title, 'inspector-panel__title')}>{title}</span>
                {subtitle ? (
                  <span className={clsx(styles.subtitle, 'inspector-panel__subtitle')}>
                    {subtitle}
                  </span>
                ) : null}
              </div>
              {onClose ? (
                <button
                  type="button"
                  className={clsx(styles.closeButton, 'inspector-panel__close')}
                  onClick={onClose}
                >
                  Close
                </button>
              ) : null}
            </div>
          ) : null)}
        <div
          className={clsx(styles.body, 'inspector-panel__body', bodyClassName)}
          style={bodyStyle}
        >
          {children}
        </div>
      </div>
    </aside>
  );
};

export default InspectorPanel;
