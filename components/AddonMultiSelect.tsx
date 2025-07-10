import Select from 'react-select';

interface AddonGroup {
  id: number;
  name: string;
}

interface AddonMultiSelectProps {
  addons: AddonGroup[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

export default function AddonMultiSelect({ addons, selectedIds, onChange }: AddonMultiSelectProps) {
  const options = addons.map((a) => ({ value: a.id, label: a.name }));
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
      inputId="addon-select"
      aria-label="Select addons"
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
