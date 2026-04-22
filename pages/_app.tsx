import '../styles/globals.css';
import '@/styles/brand.css';
import '@/styles/orders.css'; // global animations for order sheet & progress
import '@/src/styles/webpage-builder.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { BrandProvider } from '@/components/branding/BrandProvider';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { CartProvider } from '../context/CartContext';
import { OrderTypeProvider } from '../context/OrderTypeContext';
import { supabase } from '../utils/supabaseClient';
import { RestaurantProvider } from '@/lib/restaurant-context';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isRestaurantRoute = router.pathname.startsWith('/restaurant');
  const isKioskRoute = router.pathname.startsWith('/kiosk') || router.asPath.startsWith('/kiosk');
  const manifestHref = isKioskRoute ? '/kiosk.webmanifest' : '/site.webmanifest';
  const page = <Component {...pageProps} />;
  const content = isRestaurantRoute ? (
    <BrandProvider initialBrand={pageProps.initialBrand}>{page}</BrandProvider>
  ) : (
    page
  );

  return (
    <SessionContextProvider supabaseClient={supabase} initialSession={pageProps.initialSession}>
      <Head>
        <link rel="manifest" href={manifestHref} />
      </Head>
      <RestaurantProvider>
        <OrderTypeProvider>
          <CartProvider>
            {content}
          </CartProvider>
        </OrderTypeProvider>
      </RestaurantProvider>
    </SessionContextProvider>
  );
}
