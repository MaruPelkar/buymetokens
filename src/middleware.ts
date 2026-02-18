import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { SessionData } from '@/types';
import { sessionOptions } from '@/lib/auth/session';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/dashboard')) {
    if (!session.isLoggedIn || !session.userId) {
      const url = new URL('/', request.url);
      url.searchParams.set('redirect', pathname);
      url.searchParams.set('error', 'auth_required');
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith('/admin')) {
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    // Role check happens inside admin API routes (session doesn't carry role)
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
