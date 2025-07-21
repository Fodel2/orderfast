import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import OrderTypeModal from '../components/OrderTypeModal';

export type OrderType = 'delivery' | 'collection';

interface OrderTypeContextValue {
  orderType: OrderType | null;
  setOrderType: (type: OrderType) => void;
}

const OrderTypeContext = createContext<OrderTypeContextValue | undefined>(undefined);

export function OrderTypeProvider({ children }: { children: ReactNode }) {
  const [orderType, setOrderTypeState] = useState<OrderType | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('orderfast_order_type');
    if (stored === 'delivery' || stored === 'collection') {
      setOrderTypeState(stored as OrderType);
    } else {
      setShowModal(true);
    }
  }, []);

  const setOrderType = (type: OrderType) => {
    localStorage.setItem('orderfast_order_type', type);
    setOrderTypeState(type);
    setShowModal(false);
  };

  const value: OrderTypeContextValue = {
    orderType,
    setOrderType,
  };

  return (
    <OrderTypeContext.Provider value={value}>
      {children}
      {showModal && <OrderTypeModal onSelect={setOrderType} />}
    </OrderTypeContext.Provider>
  );
}

export function useOrderType() {
  const ctx = useContext(OrderTypeContext);
  if (!ctx) throw new Error('useOrderType must be used within OrderTypeProvider');
  return ctx;
}
