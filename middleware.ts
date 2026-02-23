import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareSupabaseClient } from '@supabase/auth-helpers-nextjs';

const PUBLIC_STATIC_ROUTES = new Set([
  '/site.webmanifest',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
]);

function isPublicStaticAsset(pathname: string) {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/icons/') ||
    PUBLIC_STATIC_ROUTES.has(pathname)
  );
}

export async function middleware(req: NextRequest) {
  if (isPublicStaticAsset(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (!req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const supabase = createMiddlewareSupabaseClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set(
      'redirect',
      req.nextUrl.pathname + req.nextUrl.search,
    );
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
