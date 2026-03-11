import Link from 'next/link';
import DashboardLayout from '../../../components/DashboardLayout';
import { SettingsPlaceholder } from '../../../components/dashboard/settings/SettingsShell';

export default function DashboardSettingsWebsitePage() {
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <Link href="/dashboard/settings" className="text-sm text-teal-700 hover:underline">
          ← Settings Home
        </Link>
        <SettingsPlaceholder
          title="Website"
          description="Website settings are being centralized here for domain, branding and customer app controls."
        />
      </div>
    </DashboardLayout>
  );
}
