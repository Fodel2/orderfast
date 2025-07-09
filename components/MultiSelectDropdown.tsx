import { useState, useRef, useEffect } from 'react';

// Simple dropdown that allows selecting multiple options via checkboxes.
// The parent component controls the selected ids via the `selected` prop.

interface Option {
  id: number;
  name: string;
}

interface MultiSelectDropdownProps {
  options: Option[];
  selected: number[];
  onChange: (selected: number[]) => void;
  placeholder?: string;
}

export default function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder = 'Select categories',
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const toggle = (id: number) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const label = selected
    .map((id) => options.find((o) => o.id === id)?.name)
    .filter(Boolean)
    .join(', ');

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full border border-gray-300 rounded p-2 text-left"
      >
        {label || placeholder}
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded shadow">
          {options.map((opt) => (
            <label key={opt.id} className="flex items-center px-2 py-1 space-x-2 hover:bg-gray-50">
              <input
                type="checkbox"
                className="form-checkbox"
                checked={selected.includes(opt.id)}
                onChange={() => toggle(opt.id)}
              />
              <span>{opt.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
