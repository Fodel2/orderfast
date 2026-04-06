import { useRouter } from 'next/router';
import FullscreenAppLayout from '@/components/layouts/FullscreenAppLayout';
import InternalSettlementModule from '@/components/payments/InternalSettlementModule';

export default function PosPaymentEntryPage() {
  const router = useRouter();
  const { restaurantId: routeParam } = router.query;
  const restaurantId = Array.isArray(routeParam) ? routeParam[0] : routeParam;
  const source = Array.isArray(router.query.source) ? router.query.source[0] : router.query.source;

  return (
    <FullscreenAppLayout
      promptTitle="Tap to enter fullscreen"
      promptDescription="Keep POS payment entry immersive while internal settlement is in use."
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap gap-3">
          {source === 'launcher' ? (
            <button
              type="button"
              onClick={() => {
                router.push('/dashboard/launcher').catch(() => undefined);
              }}
              className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Back to Launcher
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (!restaurantId) return;
              router.push(`/pos/${restaurantId}`).catch(() => undefined);
            }}
            className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Back to POS
          </button>
        </div>
        <InternalSettlementModule eyebrow="POS payments" title="Take Payment" restaurantId={restaurantId || null} />
      </div>
    </FullscreenAppLayout>
  );
}
