import React from 'react';

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
  onClose: () => void;
}

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
  onClose,
}: PosLaunchModalProps) {
  if (!open) return null;

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

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={onLaunchPwa}
            className="w-full rounded-xl bg-teal-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-teal-700"
          >
            {launchLabel}
          </button>
          <a
            href={apkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-base font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50"
          >
            {downloadLabel}
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
