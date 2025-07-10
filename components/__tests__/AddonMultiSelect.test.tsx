import { render, screen } from '@testing-library/react';
import AddonMultiSelect from '../AddonMultiSelect';

// Basic unit test to ensure AddonMultiSelect renders selected values
// correctly when provided with option data.

describe('AddonMultiSelect', () => {
  it('shows selected add-on names', () => {
    const addons = [
      { id: 1, name: 'Cheese' },
      { id: 2, name: 'Bacon' },
    ];
    render(
      <AddonMultiSelect
        options={addons}
        selectedIds={[1, 2]}
        onChange={() => {}}
      />
    );
    // Expect the selected values to be visible
    expect(screen.getByText('Cheese')).toBeInTheDocument();
    expect(screen.getByText('Bacon')).toBeInTheDocument();
  });
});
