import { render, screen, waitFor } from '@testing-library/react';
import CustomerLayout from '../components/CustomerLayout';
import { useRouter } from 'next/router';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('../utils/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
    }),
  },
}));

// Mock Next.js Head to simply render children for easier assertions
jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockUseRouter = useRouter as jest.Mock;

describe('CustomerLayout', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    mockUseRouter.mockReturnValue({ pathname: '/', query: {} });
  });

  it('renders children and cart count', () => {
    render(<CustomerLayout cartCount={2}>Hello</CustomerLayout>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('includes PWA meta tags by default', async () => {
    render(<CustomerLayout>Child</CustomerLayout>);
    await waitFor(() => {
      expect(document.querySelector('meta[name="theme-color"]')).toBeInTheDocument();
      expect(document.querySelector('link[rel="manifest"]')).toBeInTheDocument();
    });
  });

  it('allows disabling PWA meta tags', () => {
    render(<CustomerLayout includePwaMeta={false}>Child</CustomerLayout>);
    expect(document.querySelector('meta[name="theme-color"]')).not.toBeInTheDocument();
  });
});
