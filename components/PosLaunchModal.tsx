import React from 'react';
import type { ApkBuildStatus } from '@/utils/android/apkChannels';

interface PosLaunchModalProps {
  open: boolean;
  title?: string;
  description?: string;
  launchLabel?: string;
  downloadLabel?: string;
  rememberChoice: boolean;
  onRememberChange: (value: boolean) => void;
  onLaunchPwa: () => void;
  apkUrl: string;
  buildStatus?: ApkBuildStatus;
  statusLabel?: string;
  onClose: () => void;
}

const STATUS_STYLES: Record<ApkBuildStatus, string> = {
  building: 'bg-amber-100 text-amber-800',
  ready: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-rose-100 text-rose-800',
};

const STATUS_COPY: Record<ApkBuildStatus, string> = {
  building: 'Building',
  ready: 'Ready',
  failed: 'Failed',
};

export default function PosLaunchModal({
  open,
  title = 'Launch Till / POS',
  description = 'Choose how you want to run the POS experience.',
  launchLabel = 'Launch POS (PWA)',
  downloadLabel = 'Download POS APK',
  rememberChoice,
  onRememberChange,
  onLaunchPwa,
  apkUrl,
  buildStatus,
  statusLabel,
  onClose,
}: PosLaunchModalProps) {
  if (!open) return null;

  const downloadDisabled = buildStatus === 'building' || buildStatus === 'failed' || apkUrl === '#';

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 px-4 py-8"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{description}</p>
        {buildStatus && statusLabel ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
            <span className="font-semibold text-gray-700">{statusLabel}:</span>
            <span className={`rounded-full px-2 py-1 font-semibold ${STATUS_STYLES[buildStatus]}`}>{STATUS_COPY[buildStatus]}</span>
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={onLaunchPwa}
            className="w-full rounded-xl bg-teal-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-teal-700"
          >
            {launchLabel}
          </button>
          <a
            href={downloadDisabled ? undefined : apkUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={downloadDisabled}
            className={`flex w-full items-center justify-center rounded-xl border px-4 py-3 text-base font-semibold shadow-sm transition ${
              downloadDisabled
                ? 'cursor-not-allowed border-gray-100 bg-gray-100 text-gray-400'
                : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
            }`}
            onClick={(event) => {
              if (downloadDisabled) {
                event.preventDefault();
              }
            }}
          >
            {buildStatus === 'building' ? `${downloadLabel} (Building...)` : downloadLabel}
          </a>
        </div>

        <label className="mt-5 flex items-center gap-3 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={rememberChoice}
            onChange={(event) => onRememberChange(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
          />
          Remember my choice on this device
        </label>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
