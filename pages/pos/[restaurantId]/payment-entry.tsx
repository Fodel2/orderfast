import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import InternalSettlementModule from '@/components/payments/InternalSettlementModule';

export default function PosPaymentEntryPage() {
  const router = useRouter();
  const [flowActive, setFlowActive] = useState(false);
  const { restaurantId: routeParam } = router.query;
  const sourceParam = Array.isArray(router.query.source) ? router.query.source[0] : router.query.source;
  const restaurantId = Array.isArray(routeParam) ? routeParam[0] : routeParam;
  const source = sourceParam === 'launcher' ? 'launcher' : 'pos';

  useEffect(() => {
    router.beforePopState(() => !flowActive);
    return () => {
      router.beforePopState(() => true);
    };
  }, [flowActive, router]);

  return (
    <div className="min-h-screen w-full bg-gray-50 text-gray-900">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <InternalSettlementModule
          eyebrow="POS payments"
          title="Take Payment"
          restaurantId={restaurantId || null}
          onFlowActivityChange={setFlowActive}
          entryPoint="pos"
          source={source}
        />
      </div>
    </div>
  );
}
