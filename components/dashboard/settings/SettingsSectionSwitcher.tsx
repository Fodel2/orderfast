import { ChevronUpDownIcon } from '@heroicons/react/24/outline';

export type SettingsSwitcherItem<T extends string> = {
  key: T;
  label: string;
};

export default function SettingsSectionSwitcher<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: SettingsSwitcherItem<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="min-[480px]:hidden">
        <div className="relative max-w-xs">
          <select
            className="w-full appearance-none rounded-xl border border-gray-300 bg-white px-3 py-2 pr-10 text-sm font-medium text-gray-700 shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
            value={value}
            onChange={(event) => onChange(event.target.value as T)}
            aria-label={label}
          >
            {items.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
          <ChevronUpDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
        </div>
      </div>

      <nav
        className="hidden min-[480px]:block overflow-x-auto rounded-xl border border-gray-200 bg-white p-1.5"
        aria-label={label}
      >
        <div className="flex w-max min-w-full items-center gap-1">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition ${
                value === item.key ? 'bg-teal-600 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
