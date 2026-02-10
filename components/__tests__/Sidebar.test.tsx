import { render, screen } from '@testing-library/react';
import DashboardLayout from '../DashboardLayout';
import { useRouter } from 'next/router';

// Mock next/router to control the active route in tests
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

describe('DashboardLayout sidebar', () => {
  it('renders all sidebar labels', () => {
    // Mock router pathname so no item is active
    (useRouter as jest.Mock).mockReturnValue({ pathname: '/dashboard' });

    render(
      <DashboardLayout>
        <div>content</div>
      </DashboardLayout>
    );

    // Expect menu items to be in the document
    const labels = [
      'Home',
      'Orders',
      'Menu',
      'Express Order',
      'Promotions',
      'Till / POS',
      'KOD',
      'Kiosk',
      'Website',
      'Team',
      'Transactions',
      'Sales',
      'Invoices',
      'Settings',
    ];

    for (const label of labels) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });
});
