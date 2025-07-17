import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddonGroups from '../AddonGroups';
import type { AddonGroup } from '../../utils/types';

describe('AddonGroups single choice', () => {
  it('enforces single selection and hides quantity controls', async () => {
    const addons: AddonGroup[] = [
      {
        id: '1',
        group_id: '1',
        name: 'Size',
        required: false,
        multiple_choice: false,
        max_option_quantity: 1,
        addon_options: [
          { id: 'a', name: 'Small', price: 0 },
          { id: 'b', name: 'Large', price: 0 },
        ],
      },
    ];

    const { container } = render(<AddonGroups addons={addons} />);

    const small = screen.getByText('Small');
    const large = screen.getByText('Large');

    await userEvent.click(small);
    let selected = container.querySelectorAll('.border-green-500');
    expect(selected).toHaveLength(1);
    expect(screen.queryByText('+')).not.toBeInTheDocument();
    expect(screen.queryByText('–')).not.toBeInTheDocument();

    await userEvent.click(large);
    selected = container.querySelectorAll('.border-green-500');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent('Large');
    expect(screen.queryByText('+')).not.toBeInTheDocument();
    expect(screen.queryByText('–')).not.toBeInTheDocument();
  });
});
