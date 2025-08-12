import Head from 'next/head';
import { ReactNode } from 'react';
import BrandProvider from './customer/BrandProvider';
import CustomerHeader from './customer/CustomerHeader';
import FooterNav from './customer/FooterNav';

interface CustomerLayoutProps {
  children: ReactNode;
  cartCount?: number;
  includePwaMeta?: boolean;
  restaurant?: any;
  hideHeader?: boolean;
  hideFooter?: boolean;
}

export default function CustomerLayout({
  children,
  cartCount = 0,
  includePwaMeta = true,
  restaurant,
  hideHeader,
  hideFooter,
}: CustomerLayoutProps) {
  return (
    <BrandProvider restaurant={restaurant}>
      {includePwaMeta && (
        <Head>
          <title>OrderFast – Restaurant</title>
          <meta name="theme-color" content="#000000" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="mobile-web-app-capable" content="yes" />
          <link rel="manifest" href="/manifest.json" />
          <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        </Head>
      )}

      {!hideHeader && <CustomerHeader />}

      <main className="min-h-screen pb-24 pt-14" style={{ background: 'var(--surface)', color: 'var(--ink)' }}>
        {children}
      </main>

      <FooterNav cartCount={cartCount} hidden={hideFooter} />
    </BrandProvider>
  );
}
