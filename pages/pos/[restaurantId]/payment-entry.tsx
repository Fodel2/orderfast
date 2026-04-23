import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import InternalSettlementModule from '@/components/payments/InternalSettlementModule';
import NonFullscreenRestaurantShell from '@/components/layouts/NonFullscreenRestaurantShell';

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
    <NonFullscreenRestaurantShell contentClassName="pt-2 sm:pt-6" maxWidthClassName="max-w-none">
      <div className="w-full px-0 pb-0 sm:px-4">
        <InternalSettlementModule
          restaurantId={restaurantId || null}
          onFlowActivityChange={setFlowActive}
          entryPoint="pos"
          source={source}
        />
      </div>
    </NonFullscreenRestaurantShell>
  );
}
