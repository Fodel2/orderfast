import '../styles/globals.css'
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { useState } from 'react';
import { CartProvider } from '../context/CartContext';
import { OrderTypeProvider } from '../context/OrderTypeContext';

export default function App({ Component, pageProps }) {
  const [supabase] = useState(() => createBrowserSupabaseClient());

  return (
    <SessionContextProvider supabaseClient={supabase} initialSession={pageProps.initialSession}>
      <OrderTypeProvider>
        <CartProvider>
          <Component {...pageProps} />
        </CartProvider>
      </OrderTypeProvider>
    </SessionContextProvider>
  );
}
