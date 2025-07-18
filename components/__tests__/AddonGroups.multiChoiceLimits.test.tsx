import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddonGroups from '../AddonGroups';
import type { AddonGroup } from '../../utils/types';

describe('AddonGroups multiple choice limits', () => {
  it('enforces option and group caps', async () => {
    const addons: AddonGroup[] = [
      {
        id: '1',
        group_id: '1',
        name: 'Extras',
        required: false,
        multiple_choice: true,
        max_group_select: 2,
        max_option_quantity: 3,
        addon_options: [
          { id: 'a', name: 'Cheese', price: 0 },
          { id: 'b', name: 'Bacon', price: 0 },
          { id: 'c', name: 'Onion', price: 0 },
        ],
      },
    ];

    const { container } = render(<AddonGroups addons={addons} />);

    const cheese = screen.getByText('Cheese');
    await userEvent.click(cheese);
    await userEvent.click(cheese);
    await userEvent.click(cheese);

    // plus button should be disabled at per-option cap
    let plus = screen.getByRole('button', { name: '+' });
    expect(plus).toBeDisabled();

    // clicking again should not increase quantity
    await userEvent.click(cheese);
    expect(screen.getByText('3')).toBeInTheDocument();

    // select a second option
    const bacon = screen.getByText('Bacon');
    await userEvent.click(bacon);
    expect(screen.getByText('1')).toBeInTheDocument();

    // group cap reached - new option should not be added
    const onion = screen.getByText('Onion');
    await userEvent.click(onion);
    // only two qty displays should be present (3 and 1)
    const spans = container.querySelectorAll('span');
    const qtyVals = Array.from(spans).map(s => s.textContent);
    expect(qtyVals.filter(v => v === '1').length).toBe(1);
    expect(qtyVals.filter(v => v === '3').length).toBe(1);
  });
});
