import React from 'react';
import type { AvailabilitySnapshot } from '@/lib/customerAvailability';

type AvailabilityControlsProps = {
  availabilityLoading: boolean;
  snapshot: AvailabilitySnapshot;
  controlsDisabled: boolean;
  isConfirmingAction: boolean;
  onPauseOrders: () => void;
  onResumeOrders: () => void;
  variant?: 'orders' | 'kod';
};

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
  );
}

export default function AvailabilityControls({
  availabilityLoading,
  snapshot,
  controlsDisabled,
  isConfirmingAction,
  onPauseOrders,
  onResumeOrders,
  variant = 'orders',
}: AvailabilityControlsProps) {
  const isKod = variant === 'kod';
  const isPaused = snapshot.reason === 'manual_closed' || snapshot.reason === 'on_break';
  const primaryAction = isPaused ? onResumeOrders : onPauseOrders;
  const label = isPaused ? 'Resume Orders' : 'Pause Orders';

  return (
    <div className={`flex items-center justify-between gap-3 ${isKod ? 'rounded-xl border border-white/10 bg-white/5 px-3 py-2' : ''}`}>
      <div className="flex items-center gap-2">
        {availabilityLoading ? (
          <span className={isKod ? 'text-xs text-white/80' : 'text-sm text-gray-600'}>Checking availability…</span>
        ) : (
          <>
            <span className={isKod ? 'text-xs uppercase tracking-wide text-white/85' : 'text-sm text-gray-800'}>
              {snapshot.primaryLabel}
            </span>
            {snapshot.secondaryLabel ? (
              <span className={isKod ? 'text-[11px] text-white/60' : 'text-xs text-gray-600'}>{snapshot.secondaryLabel}</span>
            ) : null}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                snapshot.isOpenNow
                  ? isKod
                    ? 'bg-emerald-400/20 text-emerald-200'
                    : 'bg-green-100 text-green-800'
                  : isKod
                  ? 'bg-white/10 text-white/70'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {snapshot.isOpenNow ? 'Open' : 'Closed'}
            </span>
          </>
        )}
      </div>
      <button
        type="button"
        disabled={controlsDisabled}
        onClick={primaryAction}
        className={`inline-flex min-w-[144px] items-center justify-center gap-2 rounded px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
          isPaused
            ? isKod
              ? 'bg-emerald-500 text-black hover:bg-emerald-400'
              : 'bg-green-600 text-white hover:bg-green-700'
            : isKod
            ? 'bg-amber-400 text-black hover:bg-amber-300'
            : 'bg-amber-500 text-white hover:bg-amber-600'
        }`}
      >
        {isConfirmingAction ? <Spinner /> : null}
        <span>{label}</span>
      </button>
    </div>
  );
}
