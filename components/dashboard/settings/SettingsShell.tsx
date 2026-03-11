import { ReactNode } from 'react';

export type GlobalSettingsSection = {
  key: string;
  label: string;
  description?: string;
};

export function SettingsShell({
  title,
  description,
  sections,
  activeSection,
  onSelectSection,
  children,
}: {
  title: string;
  description: string;
  sections: GlobalSettingsSection[];
  activeSection: string;
  onSelectSection: (section: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-gray-600">{description}</p>
      </header>

      <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <nav className="flex flex-wrap gap-2" aria-label="Settings sections">
          {sections.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectSection(item.key)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                activeSection === item.key
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </section>

      {children}
    </div>
  );
}

export function SettingsSectionCard({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {description ? <p className="text-sm text-gray-500">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function SettingsPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <SettingsSectionCard title={title} description={description}>
      <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600">
        This section is ready for shared settings form rows and side-panel previews.
      </div>
    </SettingsSectionCard>
  );
}
