import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import FullscreenAppLayout from '@/components/layouts/FullscreenAppLayout';
import InternalSettlementModule from '@/components/payments/InternalSettlementModule';

export default function PosPaymentEntryPage() {
  const router = useRouter();
  const [flowActive, setFlowActive] = useState(false);
  const { restaurantId: routeParam } = router.query;
  const restaurantId = Array.isArray(routeParam) ? routeParam[0] : routeParam;

  useEffect(() => {
    router.beforePopState(() => !flowActive);
    return () => {
      router.beforePopState(() => true);
    };
  }, [flowActive, router]);

  return (
    <FullscreenAppLayout
      promptTitle="Tap to enter fullscreen"
      promptDescription="Keep POS payment entry immersive while internal settlement is in use."
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              if (flowActive) return;
              router.push('/dashboard/launcher').catch(() => undefined);
            }}
            disabled={flowActive}
            className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Back to Launcher
          </button>
          <button
            type="button"
            onClick={() => {
              if (flowActive) return;
              if (!restaurantId) return;
              router.push(`/pos/${restaurantId}`).catch(() => undefined);
            }}
            disabled={flowActive || !restaurantId}
            className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Back to POS
          </button>
        </div>
        <InternalSettlementModule
          eyebrow="POS payments"
          title="Take Payment"
          restaurantId={restaurantId || null}
          onFlowActivityChange={setFlowActive}
        />
      </div>
    </FullscreenAppLayout>
  );
}
