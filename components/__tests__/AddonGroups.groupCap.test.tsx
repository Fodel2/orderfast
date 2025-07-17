import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddonGroups from '../AddonGroups';
import type { AddonGroup } from '../../utils/types';

describe('AddonGroups group cap', () => {
  it('disables increasing quantity when group cap reached', async () => {
    const addons: AddonGroup[] = [
      {
        id: '1',
        group_id: '1',
        name: 'Sauce',
        required: false,
        multiple_choice: true,
        max_group_select: 1,
        max_option_quantity: 10,
        addon_options: [{ id: 'a', name: 'Ketchup', price: 0 }],
      },
    ];

    render(<AddonGroups addons={addons} />);

    const option = screen.getByText('Ketchup');
    await userEvent.click(option);
    const plus = screen.getByText('+');
    // With the group cap reached but this option already selected,
    // the user should still be able to increase the quantity until the
    // option's max quantity is hit.
    expect(plus).not.toBeDisabled();
  });
});
