import Head from 'next/head';
import { ReactNode } from 'react';
import TopBar from './customer/TopBar';
import FooterNav from './customer/FooterNav';

interface CustomerLayoutProps {
  children: ReactNode;
  cartCount?: number;
  includePwaMeta?: boolean;
  hideHeader?: boolean;
  hideFooter?: boolean;
}

export default function CustomerLayout({
  children,
  cartCount = 0,
  includePwaMeta = true,
  hideHeader,
  hideFooter,
}: CustomerLayoutProps) {
  return (
    <>
      {includePwaMeta && (
        <Head>
          <title>OrderFast – Restaurant</title>
          <meta name="theme-color" content="#000000" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="mobile-web-app-capable" content="yes" />
        </Head>
      )}

      <TopBar hidden={hideHeader} />

      <main
        className="relative flex flex-col h-screen min-h-screen"
        style={{ background: 'var(--surface)', color: 'var(--ink)' }}
      >
        <div
          id="scroll-root"
          className={`flex-1 overflow-y-auto ${hideFooter ? '' : 'pb-24'} ${hideHeader ? '' : 'pt-14'}`}
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </div>
      </main>

      {!hideFooter ? <FooterNav cartCount={cartCount} /> : null} {/* slides: footer hides on hero */}
    </>
  );
}
