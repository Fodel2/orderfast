import '../styles/globals.css';
import '@/styles/brand.css';
import '@/styles/orders.css'; // global animations for order sheet & progress
import '@/src/styles/webpage-builder.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { BrandProvider } from '@/components/branding/BrandProvider';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { CartProvider } from '../context/CartContext';
import { OrderTypeProvider } from '../context/OrderTypeContext';
import { supabase } from '../utils/supabaseClient';
import { RestaurantProvider } from '@/lib/restaurant-context';
import { exitDocumentFullscreen } from '@/lib/fullscreen';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isRestaurantRoute = router.pathname.startsWith('/restaurant');
  const isKioskRoute = router.pathname.startsWith('/kiosk') || router.asPath.startsWith('/kiosk');
  const manifestHref = isKioskRoute ? '/kiosk.webmanifest' : '/site.webmanifest';

  useEffect(() => {
    const currentPath = router.asPath.split('?')[0] || '';
    const allowsFullscreenOwnership =
      currentPath.startsWith('/kiosk/') || currentPath.startsWith('/kod/') || currentPath.startsWith('/pos/');
    if (!allowsFullscreenOwnership) {
      void exitDocumentFullscreen();
    }
  }, [router.asPath]);

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
