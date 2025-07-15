import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
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

