import Select from 'react-select';

interface MenuItem {
  id: number;
  name: string;
}

interface ItemMultiSelectProps {
  items: MenuItem[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  disabledIds?: number[];
}

export default function ItemMultiSelect({ items, selectedIds, onChange, disabledIds = [] }: ItemMultiSelectProps) {
  const options = items.map((item) => ({ value: item.id, label: item.name }));
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
      inputId="item-select"
      aria-label="Select items"
      isMulti
      options={options}
      value={value}
      onChange={(opts) => onChange(Array.isArray(opts) ? opts.map((o) => o.value) : [])}
      isOptionDisabled={(opt) => disabledIds.includes(opt.value)}
      styles={styles}
      classNamePrefix="rs"
      className="react-select-container"
    />
  );
}
