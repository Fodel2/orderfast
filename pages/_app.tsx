import '../styles/globals.css';
import '../styles/brand.css'; // brand: tokens
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { CartProvider } from '../context/CartContext';
import { OrderTypeProvider } from '../context/OrderTypeContext';
import { supabase } from '../utils/supabaseClient';

export default function App({ Component, pageProps }) {
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
