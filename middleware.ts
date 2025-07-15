import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_FILE = /\.(.*)$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const host = request.headers.get('host') || '';
  const hostname = host.split(':')[0];
  const subdomain = hostname.split('.')[0];

  if (
    subdomain &&
    subdomain !== 'www' &&
    subdomain !== 'whatsthatorder' &&
    hostname.split('.').length > 2
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/restaurant';
    url.searchParams.set('subdomain', subdomain);
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

