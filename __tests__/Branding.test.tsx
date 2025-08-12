import React from 'react';
import { render, screen, act } from '@testing-library/react';
import CustomerLayout from '../components/CustomerLayout';
import Hero from '../components/customer/Hero';
import OpenBadge from '../components/customer/OpenBadge';
import BrandProvider from '../components/customer/BrandProvider';

jest.mock('../utils/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
    }),
  },
}));

jest.mock('next/router', () => ({
  useRouter: () => ({ query: {} }),
}));

const restaurant = { id: 1, name: 'Demo Diner', is_open: true, brand_color: '#ff0000' };

test('brand variables apply to button and badge', () => {
  render(
    <BrandProvider restaurant={restaurant}>
      <button data-testid="btn" style={{ background: 'var(--brand)' }}>
        Btn
      </button>
      <OpenBadge isOpen />
    </BrandProvider>
  );
  const btn = screen.getByTestId('btn');
  const badge = screen.getByText('Open');
  const root = btn.closest('[data-brand]') as HTMLElement;
  expect(root).toHaveStyle('--brand: #ff0000');
  expect(btn).toHaveStyle('background: var(--brand)');
  expect(badge).toHaveStyle('border: 1px solid var(--brand)');
  expect(badge).toHaveClass('brand-pill');
});

test('footer hidden on hero and appears after scroll', () => {
  let ioCallback: any = null;
  (window as any).IntersectionObserver = class {
    constructor(cb: any) {
      ioCallback = cb;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  function Wrapper() {
    const [visible, setVisible] = React.useState(true);
    return (
      <CustomerLayout restaurant={restaurant} hideFooter={visible} hideHeader={visible}>
        <Hero restaurant={restaurant} onVisibilityChange={setVisible} />
      </CustomerLayout>
    );
  }

  render(<Wrapper />);
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  act(() => ioCallback([{ isIntersecting: false }]));
  expect(screen.getByRole('navigation')).toBeInTheDocument();
});
