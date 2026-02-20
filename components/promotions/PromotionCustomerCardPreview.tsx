interface PromotionCustomerCardPreviewProps {
  title: string;
  valueLabel: string;
  scheduleLine: string;
  minSpendLine?: string | null;
}

export default function PromotionCustomerCardPreview({
  title,
  valueLabel,
  scheduleLine,
  minSpendLine,
}: PromotionCustomerCardPreviewProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-teal-600">Promotion</p>
          <h3 className="mt-1 text-lg font-semibold text-gray-900">{title || 'Untitled promotion'}</h3>
        </div>
        <div className="rounded-xl bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-700">
          {valueLabel}
        </div>
      </div>

      <div className="mt-4 space-y-1 text-sm text-gray-600">
        <p>{scheduleLine}</p>
        {minSpendLine ? <p>{minSpendLine}</p> : null}
      </div>

      <button
        type="button"
        className="mt-4 inline-flex rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
      >
        Terms
      </button>
    </div>
  );
}
