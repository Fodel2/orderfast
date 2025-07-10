import Select from 'react-select';

interface AddonGroup {
  id: number;
  name: string;
}

interface AddonMultiSelectProps {
  options: AddonGroup[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

export default function AddonMultiSelect({ options, selectedIds, onChange }: AddonMultiSelectProps) {
  const selectOptions = options.map(g => ({ value: g.id, label: g.name }));
  const value = selectOptions.filter(o => selectedIds.includes(o.value));

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
      inputId="addon-select"
      aria-label="Select add-ons"
      isMulti
      options={selectOptions}
      value={value}
      onChange={(opts) => onChange(Array.isArray(opts) ? opts.map(o => o.value) : [])}
      styles={styles}
      classNamePrefix="rs"
      className="react-select-container"
    />
  );
}
