import '../styles/globals.css';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { CartProvider } from '../context/CartContext';
import { OrderTypeProvider } from '../context/OrderTypeContext';
import CartDrawer from '../components/CartDrawer';

export default function App({ Component, pageProps }) {
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const router = useRouter();


  return (
    <SessionContextProvider supabaseClient={supabase} initialSession={pageProps.initialSession}>
      <OrderTypeProvider>
        <CartProvider>
          <Component {...pageProps} />
          {router.pathname !== '/checkout' && <CartDrawer />}
        </CartProvider>
      </OrderTypeProvider>
    </SessionContextProvider>
  );
}
