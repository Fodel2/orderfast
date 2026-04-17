import { CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { useMemo } from 'react';

type NativeTapToPayPreHandoverOverlayProps = {
  visible: boolean;
  lines?: string[];
  lineIndex?: number;
  showSuccessTick?: boolean;
  canClose?: boolean;
  onClose?: () => void;
  terminalState?: 'success' | 'canceled' | 'failed' | null;
  recoveryActionLabel?: string;
  onRecoveryAction?: () => void;
};

const DEFAULT_LINES = ['Preparing payment…'];

export default function NativeTapToPayPreHandoverOverlay({
  visible,
  lines = DEFAULT_LINES,
  lineIndex = 0,
  showSuccessTick = false,
  canClose = false,
  onClose,
  terminalState = null,
  recoveryActionLabel,
  onRecoveryAction,
}: NativeTapToPayPreHandoverOverlayProps) {
  const activeLine = useMemo(() => {
    if (!lines.length) return '';
    const safeIndex = Number.isFinite(lineIndex) ? Math.abs(lineIndex) % lines.length : 0;
    return lines[safeIndex] || lines[0];
  }, [lineIndex, lines]);

  if (!visible) return null;

  const activeTerminalState = terminalState || (showSuccessTick ? 'success' : null);
  const statusCopy =
    activeTerminalState === 'success'
      ? 'Payment confirmed'
      : activeTerminalState === 'canceled'
        ? 'Payment canceled'
        : activeTerminalState === 'failed'
          ? 'Payment failed'
          : activeLine;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/45 px-6 py-8 backdrop-blur-md">
      {canClose ? (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full border border-white/40 bg-white/15 p-2 text-white transition hover:bg-white/25"
          aria-label="Close payment transition"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      ) : null}
      <div className="flex flex-col items-center gap-5 text-center text-white">
        {activeTerminalState === 'success' ? (
          <CheckCircleIcon className="h-16 w-16 text-emerald-300" />
        ) : activeTerminalState === 'canceled' ? (
          <XCircleIcon className="h-16 w-16 text-amber-300" />
        ) : activeTerminalState === 'failed' ? (
          <ExclamationTriangleIcon className="h-16 w-16 text-rose-300" />
        ) : (
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-white/45 border-t-white" />
        )}
        <p className="text-base font-medium tracking-wide text-white/95">{statusCopy}</p>
        {recoveryActionLabel && onRecoveryAction ? (
          <button
            type="button"
            onClick={onRecoveryAction}
            className="rounded-full border border-white/40 bg-white/15 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/25"
          >
            {recoveryActionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
