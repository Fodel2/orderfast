import { render, screen } from '@testing-library/react';
import StockTab from '../components/StockTab';

describe('StockTab', () => {
  it('renders title and toggle button', () => {
    render(<StockTab categories={[]} addons={[]} />);
    expect(screen.getByText(/Live Stock Control/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Collapse all/i)).toBeInTheDocument();
  });
});
