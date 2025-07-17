import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddonGroups from '../AddonGroups';
import type { AddonGroup } from '../../utils/types';

describe('AddonGroups quantity increments when group at cap', () => {
  it('allows increasing qty for existing option when group cap reached', async () => {
    const addons: AddonGroup[] = [
      {
        id: '1',
        group_id: '1',
        name: 'Sauce',
        required: false,
        multiple_choice: true,
        max_group_select: 1,
        max_option_quantity: 10,
        addon_options: [
          { id: 'a', name: 'Ketchup', price: 0 },
          { id: 'b', name: 'Mayo', price: 0 },
        ],
      },
    ];

    render(<AddonGroups addons={addons} />);

    const ketchup = screen.getByText('Ketchup');
    const mayo = screen.getByText('Mayo');

    await userEvent.click(ketchup); // select ketchup
    // try to select mayo - should not add due to cap
    await userEvent.click(mayo);
    expect(screen.queryByText('1', { selector: 'span' })).toBeInTheDocument();
    // try to increase ketchup qty
    const plus = screen.getByText('+');
    expect(plus).not.toBeDisabled();
    await userEvent.click(plus);
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
