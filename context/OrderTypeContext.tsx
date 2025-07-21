import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type OrderType = 'delivery' | 'collection';

interface OrderTypeContextValue {
  orderType: OrderType | null;
  setOrderType: (type: OrderType) => void;
}

const OrderTypeContext = createContext<OrderTypeContextValue | undefined>(undefined);

export function OrderTypeProvider({ children }: { children: ReactNode }) {
  const [orderType, setOrderTypeState] = useState<OrderType | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('orderfast_order_type');
    if (stored === 'delivery' || stored === 'collection') {
      setOrderTypeState(stored as OrderType);
    }
  }, []);

  const setOrderType = (type: OrderType) => {
    localStorage.setItem('orderfast_order_type', type);
    setOrderTypeState(type);
  };

  const value: OrderTypeContextValue = {
    orderType,
    setOrderType,
  };

  return (
    <OrderTypeContext.Provider value={value}>{children}</OrderTypeContext.Provider>
  );
}

export function useOrderType() {
  const ctx = useContext(OrderTypeContext);
  if (!ctx) throw new Error('useOrderType must be used within OrderTypeProvider');
  return ctx;
}
