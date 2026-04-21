import DashboardLayout from '@/components/DashboardLayout';
import InternalSettlementModule from '@/components/payments/InternalSettlementModule';

export default function DashboardTakePaymentPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <InternalSettlementModule
          entryPoint="take_payment"
        />
      </div>
    </DashboardLayout>
  );
}
