import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddonGroups from '../AddonGroups';
import type { AddonGroup } from '../../utils/types';

describe('AddonGroups', () => {
  it('renders group and option names', () => {
    const addons: AddonGroup[] = [
      {
        id: '1',
        name: 'Size',
        required: true,
        multiple_choice: false,
        max_group_select: 1,
        addon_options: [
          { id: 'a', name: 'Small', price: 0 },
          { id: 'b', name: 'Large', price: 150 },
        ],
      },
    ];

    render(<AddonGroups addons={addons} />);

    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByText('Small')).toBeInTheDocument();
    expect(screen.getByText('Large')).toBeInTheDocument();
  });

  it('increments quantity and shows controls on tile click', async () => {
    const addons: AddonGroup[] = [
      {
        id: '1',
        name: 'Extras',
        required: false,
        multiple_choice: true,
        max_group_select: 2,
        max_option_quantity: 2,
        addon_options: [
          { id: 'a', name: 'Cheese', price: 50 },
        ],
      },
    ];

    render(<AddonGroups addons={addons} />);

    const option = screen.getByText('Cheese');
    await userEvent.click(option);

    expect(screen.getByText('1')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Cheese'));
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
