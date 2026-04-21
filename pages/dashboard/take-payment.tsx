import DashboardLayout from '@/components/DashboardLayout';
import InternalSettlementModule from '@/components/payments/InternalSettlementModule';

export default function DashboardTakePaymentPage() {
  return (
    <DashboardLayout>
      <div className="w-full px-0 py-0 sm:px-4 sm:py-6">
        <InternalSettlementModule
          entryPoint="take_payment"
        />
      </div>
    </DashboardLayout>
  );
}
