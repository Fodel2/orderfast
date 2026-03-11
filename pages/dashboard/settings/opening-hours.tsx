import Link from 'next/link';
import DashboardLayout from '../../../components/DashboardLayout';
import { SettingsPlaceholder } from '../../../components/dashboard/settings/SettingsShell';

export default function DashboardSettingsOpeningHoursPage() {
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <Link href="/dashboard/settings" className="text-sm text-teal-700 hover:underline">
          ← Settings Home
        </Link>
        <SettingsPlaceholder
          title="Opening Hours"
          description="Service windows, schedule controls and temporary changes."
        />
      </div>
    </DashboardLayout>
  );
}
