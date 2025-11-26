import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import CustomerLayout from '../components/CustomerLayout';
import Hero from '../components/customer/Hero';
import Slides from '../components/customer/Slides';
import OpenBadge from '../components/customer/OpenBadge';
import BrandProvider from '../components/branding/BrandProvider';

jest.mock('next/router', () => ({
  useRouter: () => ({ query: {} }),
}));

const restaurant = { id: 1, name: 'Demo Diner', is_open: true, brand_color: '#ff0000' };

test('brand variables apply to button and badge', async () => {
  render(
    <BrandProvider restaurant={restaurant}>
      <button data-testid="btn" className="btn-primary">
        Btn
      </button>
      <OpenBadge isOpen />
    </BrandProvider>
  );
  const btn = screen.getByTestId('btn');
  const badge = screen.getByText('Open');
  const root = btn.closest('[data-brand-root]') as HTMLElement;
  expect(root).toHaveStyle('--brand: #ff0000');
  expect(btn).toHaveClass('btn-primary');
  await waitFor(() => expect(badge).toHaveStyle('border: 1px solid #ff0000'));
  expect(badge).toHaveClass('pill');
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
      <CustomerLayout hideFooter={visible} hideHeader>
        <Slides onHeroInView={setVisible}>
          <Hero restaurant={restaurant} />
        </Slides>
      </CustomerLayout>
    );
  }

  render(<Wrapper />);
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  act(() => ioCallback([{ isIntersecting: false }]));
  expect(screen.getByRole('navigation')).toBeInTheDocument();
});
