import { useCart } from '../context/CartContext';

export default function CartTest() {
  const { cart, subtotal, addToCart, clearCart } = useCart();

  const handleAdd = () => {
    addToCart('test', {
      item_id: 'test-burger',
      name: 'Burger',
      price: 9.99,
      quantity: 1,
    });
  };

  return (
    <div className="p-4 space-y-4">
      <p className="text-lg">Items in cart: {cart.items.length}</p>
      <p className="text-lg">Subtotal: ${(subtotal / 100).toFixed(2)}</p>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={handleAdd}
          className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
        >
          Add Test Item
        </button>
        <button
          type="button"
          onClick={clearCart}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Clear Plate
        </button>
      </div>
    </div>
  );
}
