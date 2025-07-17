import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddonGroups from '../AddonGroups';
import type { AddonGroup } from '../../utils/types';

describe('AddonGroups group cap', () => {
  it('allows multiple quantities for single option even if group cap is 1', async () => {
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
    await userEvent.click(screen.getByText('+'));
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
