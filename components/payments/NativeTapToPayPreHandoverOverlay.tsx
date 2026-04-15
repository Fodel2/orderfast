import { useMemo } from 'react';

type NativeTapToPayPreHandoverOverlayProps = {
  visible: boolean;
  title?: string;
  message?: string;
  phaseLabel?: string;
  lines?: string[];
  lineIndex?: number;
};

const DEFAULT_LINES = [
  'Activating contactless payments…',
  'Preparing Tap to Pay…',
  'Waking up the payment magic…',
  'Getting ready for contactless…',
];

export default function NativeTapToPayPreHandoverOverlay({
  visible,
  title = 'Contactless payments',
  message,
  phaseLabel = 'Preparing payment mode',
  lines = DEFAULT_LINES,
  lineIndex = 0,
}: NativeTapToPayPreHandoverOverlayProps) {
  const activeLine = useMemo(() => {
    if (!lines.length) return '';
    const safeIndex = Number.isFinite(lineIndex) ? Math.abs(lineIndex) % lines.length : 0;
    return lines[safeIndex] || lines[0];
  }, [lineIndex, lines]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-500/45 px-4 py-6 backdrop-blur-[2px]">
      <section className="w-full max-w-xl rounded-[2rem] border border-slate-200/70 bg-slate-100/95 p-7 text-center shadow-2xl sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{phaseLabel}</p>
        <div className="mx-auto mt-5 h-11 w-11 animate-spin rounded-full border-4 border-white/80 border-t-slate-600" />
        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-3 text-base font-medium text-slate-700">{message || activeLine}</p>
      </section>
    </div>
  );
}
