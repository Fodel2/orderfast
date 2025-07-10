import { render, screen } from '@testing-library/react';
import ItemMultiSelect from '../ItemMultiSelect';

describe('ItemMultiSelect', () => {
  it('shows selected item names', () => {
    const items = [
      { id: 1, name: 'Burger' },
      { id: 2, name: 'Fries' },
    ];
    render(
      <ItemMultiSelect items={items} selectedIds={[1, 2]} onChange={() => {}} />
    );
    expect(screen.getByText('Burger')).toBeInTheDocument();
    expect(screen.getByText('Fries')).toBeInTheDocument();
  });
});
