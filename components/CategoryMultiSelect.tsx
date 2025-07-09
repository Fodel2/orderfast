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
