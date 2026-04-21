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
      <div className="w-full px-0 py-0 sm:px-4 sm:py-6">
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
