import Link from 'next/link';
import DashboardLayout from '../../../components/DashboardLayout';
import { SettingsPlaceholder } from '../../../components/dashboard/settings/SettingsShell';

export default function DashboardSettingsIntegrationsPage() {
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <Link href="/dashboard/settings" className="text-sm text-teal-700 hover:underline">
          ← Settings Home
        </Link>
        <SettingsPlaceholder
          title="Integrations"
          description="Delivery, marketing and platform integrations will be configured from this area."
        />
      </div>
    </DashboardLayout>
  );
}
