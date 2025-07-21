import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface CartAddon {
  option_id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CartItem {
  item_id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  addons?: CartAddon[];
}

interface CartState {
  restaurant_id: string | null;
  items: CartItem[];
}

interface CartContextValue {
  cart: CartState;
  subtotal: number;
  addToCart: (restaurantId: string, item: CartItem) => void;
  removeFromCart: (item_id: string) => void;
  updateQuantity: (item_id: string, newQty: number) => void;
  clearCart: () => void;
  setItemNotes: (item_id: string, notes: string) => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartState>({ restaurant_id: null, items: [] });

  // Load cart from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('orderfast_cart');
    if (saved) {
      try {
        setCart(JSON.parse(saved));
      } catch (err) {
        console.error('Failed to parse cart', err);
      }
    }
  }, []);

  // Persist cart to localStorage
  useEffect(() => {
    localStorage.setItem('orderfast_cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (restaurantId: string, item: CartItem) => {
    setCart((prev) => {
      let newState = { ...prev };
      if (!prev.restaurant_id || prev.restaurant_id !== restaurantId) {
        newState = { restaurant_id: restaurantId, items: [] };
      }
      const existing = newState.items.find((i) => i.item_id === item.item_id);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        newState.items.push({ ...item });
      }
      return { ...newState };
    });
  };

  const removeFromCart = (item_id: string) => {
    setCart((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.item_id !== item_id),
    }));
  };

  const updateQuantity = (item_id: string, newQty: number) => {
    if (newQty <= 0) return removeFromCart(item_id);
    setCart((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.item_id === item_id ? { ...it, quantity: newQty } : it
      ),
    }));
  };

  const clearCart = () => {
    setCart({ restaurant_id: null, items: [] });
  };

  const setItemNotes = (item_id: string, notes: string) => {
    setCart((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.item_id === item_id ? { ...it, notes } : it
      ),
    }));
  };

  const subtotal = cart.items.reduce((sum, item) => {
    const addonsTotal = (item.addons || []).reduce(
      (aSum, a) => aSum + a.price * a.quantity,
      0
    );
    return sum + (item.price * item.quantity + addonsTotal);
  }, 0);

  const value: CartContextValue = {
    cart,
    subtotal,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    setItemNotes,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
