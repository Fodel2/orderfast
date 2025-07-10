import { render, screen } from '@testing-library/react';
import StockTab from '../components/StockTab';

describe('StockTab', () => {
  it('renders title and buttons', () => {
    render(<StockTab categories={[]} addons={[]} />);
    expect(screen.getByText(/Live Stock Control/)).toBeInTheDocument();
    expect(screen.getByText('⬇ Expand All')).toBeInTheDocument();
    expect(screen.getByText('⬆ Collapse All')).toBeInTheDocument();
  });
});
