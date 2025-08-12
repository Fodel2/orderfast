import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareSupabaseClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
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
  matcher: ['/dashboard/:path*'],
};

