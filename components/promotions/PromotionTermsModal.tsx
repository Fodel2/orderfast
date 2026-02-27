import { XMarkIcon } from '@heroicons/react/24/outline';

type PromotionTermsModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  offerTerms: string[];
  restaurantNote?: string | null;
  globalTerms?: string | null;
};

export default function PromotionTermsModal({
  open,
  onClose,
  title,
  offerTerms,
  restaurantNote,
  globalTerms,
}: PromotionTermsModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 p-3 sm:items-center" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Terms</p>
            <h3 className="text-base font-semibold text-slate-900">{title || 'Promotion terms'}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[75vh] space-y-4 overflow-y-auto px-4 py-4 text-sm text-slate-700">
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Offer terms</h4>
            {offerTerms.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {offerTerms.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-slate-500">No additional terms.</p>
            )}
          </section>

          {restaurantNote?.trim() ? (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Restaurant note</h4>
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2">{restaurantNote.trim()}</p>
            </section>
          ) : null}

          {globalTerms?.trim() ? (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Restaurant terms</h4>
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2">{globalTerms.trim()}</p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
