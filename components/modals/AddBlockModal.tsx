import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';

import { tokens } from '@/src/ui/tokens';

export type AddBlockOption = {
  kind: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

type AddBlockModalProps = {
  open: boolean;
  options: ReadonlyArray<AddBlockOption>;
  onSelect: (kind: string) => void;
  onClose: () => void;
  containerRef?: React.RefObject<HTMLElement | null>;
};

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function AddBlockModal({
  open,
  options,
  onSelect,
  onClose,
  containerRef,
}: AddBlockModalProps) {
  const [shouldRender, setShouldRender] = useState(open);
  const [visible, setVisible] = useState(open);
  const [isNarrow, setIsNarrow] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsNarrow(false);
      return;
    }
    const query = window.matchMedia('(max-width: 768px)');
    const updateMatch = () => setIsNarrow(query.matches);
    updateMatch();

    const listener = (event: MediaQueryListEvent) => setIsNarrow(event.matches);
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', listener);
      return () => {
        query.removeEventListener('change', listener);
      };
    }

    // Safari fallback
    const legacyListener = (event: MediaQueryListEvent) => setIsNarrow(event.matches);
    query.addListener(legacyListener);
    return () => {
      query.removeListener(legacyListener);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      return;
    }
    if (typeof window === 'undefined') {
      setShouldRender(false);
      return;
    }
    const timeout = window.setTimeout(() => setShouldRender(false), 200);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    if (typeof window === 'undefined') {
      setVisible(true);
      return;
    }
    const raf = window.requestAnimationFrame(() => setVisible(true));
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return;
    }
    const previousActive = document.activeElement as HTMLElement | null;
    const node = modalRef.current;
    const focusable = node?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusable && focusable.length > 0) {
      focusable[0].focus();
    } else {
      node?.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'Tab' && node) {
        const focusableElements = node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusableElements.length === 0) {
          event.preventDefault();
          return;
        }
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement as HTMLElement | null;
        if (event.shiftKey) {
          if (activeElement === first || !node.contains(activeElement)) {
            event.preventDefault();
            last.focus();
          }
        } else if (activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousActive && typeof previousActive.focus === 'function') {
        previousActive.focus();
      }
    };
  }, [open, onClose]);

  if (!shouldRender || typeof document === 'undefined') {
    return null;
  }

  const container = containerRef?.current ?? document.body;
  if (!container) {
    return null;
  }

  const handleContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add a block"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        display: 'flex',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: tokens.spacing.lg,
        background: 'rgba(0, 0, 0, 0.35)',
        backdropFilter: 'blur(2px)',
        opacity: visible ? 1 : 0,
        transition: `opacity 200ms ${tokens.easing.standard}`,
        pointerEvents: open ? 'auto' : 'none',
      }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        onClick={handleContainerClick}
        style={{
          position: 'relative',
          width: 'min(720px, calc(100% - 32px))',
          background: tokens.colors.surface,
          borderRadius: 16,
          margin: `${isNarrow ? tokens.spacing.xl : 64}px auto`,
          padding: isNarrow ? tokens.spacing.md : tokens.spacing.xl,
          boxShadow: tokens.shadow.lg,
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.spacing.lg,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(12px)',
          transition: `opacity 200ms ${tokens.easing.standard}, transform 200ms ${tokens.easing.standard}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: tokens.spacing.md,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span
              style={{
                fontSize: tokens.fontSize.xl,
                fontWeight: tokens.fontWeight.semibold,
                color: tokens.colors.textPrimary,
              }}
            >
              Add a block
            </span>
            <span
              style={{
                fontSize: tokens.fontSize.sm,
                color: tokens.colors.textMuted,
              }}
            >
              Choose a content block to insert into your page layout.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: tokens.radius.md,
              border: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
              background: tokens.colors.surface,
              color: tokens.colors.textSecondary,
              padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isNarrow ? '1fr' : 'repeat(2, minmax(0, 1fr))',
            gap: tokens.spacing.md,
          }}
        >
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.kind}
                type="button"
                onClick={() => onSelect(option.kind)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: tokens.spacing.sm,
                  borderRadius: tokens.radius.md,
                  border: `${tokens.border.thin}px solid ${tokens.colors.borderLight}`,
                  background: tokens.colors.surfaceSubtle,
                  padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: `border-color 160ms ${tokens.easing.standard}, background-color 160ms ${tokens.easing.standard}, transform 160ms ${tokens.easing.standard}`,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: tokens.spacing.lg,
                    height: tokens.spacing.lg,
                    borderRadius: tokens.radius.sm,
                    background: 'rgba(14, 165, 233, 0.12)',
                    color: tokens.colors.accent,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} strokeWidth={1.6} />
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span
                    style={{
                      fontSize: tokens.fontSize.sm,
                      fontWeight: tokens.fontWeight.medium,
                      color: tokens.colors.textSecondary,
                    }}
                  >
                    {option.title}
                  </span>
                  <span
                    style={{
                      fontSize: tokens.fontSize.xs,
                      color: tokens.colors.textMuted,
                      lineHeight: 1.4,
                    }}
                  >
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    container,
  );
}
