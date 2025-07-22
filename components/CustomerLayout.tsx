import Head from 'next/head';
import { ReactNode } from 'react';
import BottomNavBar from './BottomNavBar';

interface CustomerLayoutProps {
  children: ReactNode;
  cartCount?: number;
  includePwaMeta?: boolean;
}

export default function CustomerLayout({
  children,
  cartCount = 0,
  includePwaMeta = true,
}: CustomerLayoutProps) {
  return (
    <>
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

      <main className="min-h-screen pb-24 bg-white text-gray-900">
        {children}
      </main>

      <BottomNavBar cartCount={cartCount} />
    </>
  );
}
