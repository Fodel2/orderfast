import { render, screen } from '@testing-library/react';
import AddonGroups, { AddonGroup } from '../AddonGroups';

describe('AddonGroups', () => {
  it('renders group and option names', () => {
    const addons: AddonGroup[] = [
      {
        group_id: '1',
        group_name: 'Size',
        required: true,
        multiple_choice: false,
        max_group_select: 1,
        max_option_quantity: 1,
        options: [
          { id: 'a', name: 'Small', price: 0 },
          { id: 'b', name: 'Large', price: 1.5 },
        ],
      },
    ];

    render(<AddonGroups addons={addons} />);

    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByText('Small')).toBeInTheDocument();
    expect(screen.getByText('Large')).toBeInTheDocument();
  });
});
