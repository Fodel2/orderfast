import '../styles/globals.css';
import '@/styles/brand.css';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { BrandProvider } from '@/components/branding/BrandProvider';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { CartProvider } from '../context/CartContext';
import { OrderTypeProvider } from '../context/OrderTypeContext';
import { supabase } from '../utils/supabaseClient';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isRestaurantRoute = router.pathname.startsWith('/restaurant');
  const page = <Component {...pageProps} />;
  const content = isRestaurantRoute ? <BrandProvider>{page}</BrandProvider> : page;

  return (
    <SessionContextProvider supabaseClient={supabase} initialSession={pageProps.initialSession}>
      <OrderTypeProvider>
        <CartProvider>
          {content}
        </CartProvider>
      </OrderTypeProvider>
    </SessionContextProvider>
  );
}
