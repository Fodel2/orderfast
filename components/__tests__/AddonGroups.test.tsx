import { render, screen } from '@testing-library/react';
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
});
