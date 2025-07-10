import Select from 'react-select';

interface Category {
  id: number;
  name: string;
}

interface CategoryMultiSelectProps {
  categories: Category[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

export default function CategoryMultiSelect({
  categories,
  selectedIds,
  onChange,
}: CategoryMultiSelectProps) {
  const options = categories.map((c) => ({ value: c.id, label: c.name }));
  const value = options.filter((opt) => selectedIds.includes(opt.value));

  const styles = {
    control: (base: any) => ({
      ...base,
      borderColor: '#d1d5db',
      paddingTop: '0.125rem',
      paddingBottom: '0.125rem',
    }),
    menu: (base: any) => ({ ...base, zIndex: 60 }),
    multiValue: (base: any) => ({
      ...base,
      backgroundColor: '#14b8a6',
      borderRadius: '9999px',
    }),
    multiValueLabel: (base: any) => ({
      ...base,
      color: 'white',
      fontWeight: 500,
    }),
    multiValueRemove: (base: any) => ({
      ...base,
      color: 'white',
      ':hover': { backgroundColor: '#0d9488', color: 'white' },
    }),
  };

  return (
    <Select
      inputId="category-select"
      aria-label="Select categories"
      isMulti
      options={options}
      value={value}
      onChange={(opts) =>
        onChange(Array.isArray(opts) ? opts.map((o) => o.value) : [])
      }
      styles={styles}
      classNamePrefix="rs"
      className="react-select-container"
    />
  );
}
