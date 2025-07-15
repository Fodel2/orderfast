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

  const ROOT_DOMAIN = 'orderfast.vercel.app';

  if (hostname === ROOT_DOMAIN) {
    return NextResponse.next();
  }

  const subdomain = hostname.replace(`.${ROOT_DOMAIN}`, '');

  if (
    hostname.endsWith(`.${ROOT_DOMAIN}`) &&
    subdomain &&
    subdomain !== 'www' &&
    subdomain !== 'whatsthatorder'
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/restaurant';
    url.searchParams.set('subdomain', subdomain);
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

