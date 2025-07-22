import '../styles/globals.css';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { CartProvider } from '../context/CartContext';
import { OrderTypeProvider } from '../context/OrderTypeContext';
import CartDrawer from '../components/CartDrawer';
import BottomNavBar from '../components/BottomNavBar';
import { useCart } from '../context/CartContext';

export default function App({ Component, pageProps }) {
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const router = useRouter();

  const isCustomerPage = router.pathname.startsWith('/website');

  function BottomNavWrapper() {
    const { cart } = useCart();
    const count = cart.items.reduce((sum, it) => sum + it.quantity, 0);
    if (!isCustomerPage || router.pathname === '/checkout') return null;
    return <BottomNavBar cartCount={count} />;
  }

  return (
    <SessionContextProvider supabaseClient={supabase} initialSession={pageProps.initialSession}>
      <OrderTypeProvider>
        <CartProvider>
          <Component {...pageProps} />
          {router.pathname !== '/checkout' && <CartDrawer />}
          <BottomNavWrapper />
        </CartProvider>
      </OrderTypeProvider>
    </SessionContextProvider>
  );
}
