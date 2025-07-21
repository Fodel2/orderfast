import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MenuItemCard from '../components/MenuItemCard';
import { useCart } from '../context/CartContext';

jest.mock('../utils/getAddonsForItem', () => ({
  getAddonsForItem: jest.fn(() => Promise.resolve([])),
}));

jest.mock('../context/CartContext', () => ({
  useCart: jest.fn(),
}));

const mockUseCart = useCart as jest.Mock;

describe('MenuItemCard', () => {
  beforeEach(() => {
    mockUseCart.mockReturnValue({
      cart: { restaurant_id: null, items: [] },
      subtotal: 0,
      addToCart: jest.fn(),
      removeFromCart: jest.fn(),
      updateQuantity: jest.fn(),
      clearCart: jest.fn(),
      setItemNotes: jest.fn(),
    });
  });

  it('opens modal and updates quantity inside', async () => {
    render(
      <MenuItemCard item={{ id: 1, name: 'Burger', price: 5 }} restaurantId="1" />
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add to Cart' }));
    await user.click(screen.getByRole('button', { name: '+' }));
    expect(screen.getByTestId('qty').textContent).toBe('2');
  });

  it('does not allow quantity below 1 in modal', async () => {
    const item = { id: 2, name: 'Fries', price: 3 };
    render(<MenuItemCard item={item} restaurantId="1" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add to Cart' }));
    await user.click(screen.getByRole('button', { name: '-' }));
    expect(screen.getByTestId('qty').textContent).toBe('1');
  });
});
