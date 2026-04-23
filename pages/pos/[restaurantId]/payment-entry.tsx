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
    <div
      className="min-h-screen w-full bg-gray-900 text-gray-900"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="w-full px-0 pb-0 pt-2 sm:px-4 sm:py-6">
        <InternalSettlementModule
          restaurantId={restaurantId || null}
          onFlowActivityChange={setFlowActive}
          entryPoint="pos"
          source={source}
        />
      </div>
    </div>
  );
}
