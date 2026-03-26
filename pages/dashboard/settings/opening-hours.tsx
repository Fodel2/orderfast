import Link from 'next/link';
import DashboardLayout from '../../../components/DashboardLayout';

export default function DashboardSettingsOpeningHoursPage() {
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <Link href="/dashboard/settings" className="text-sm text-teal-700 hover:underline">
          ← Settings Home
        </Link>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-3">
          <h1 className="text-3xl font-bold">Opening Hours</h1>
          <p className="text-sm text-gray-600">
            Opening Hours editing is temporarily unavailable in this environment.
          </p>
          <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600">
            This page has been safely neutralised until the required runtime schema is available.
            No opening-hours data is being read or written from here right now.
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
