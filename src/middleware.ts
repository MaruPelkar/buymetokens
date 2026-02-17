import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { SessionData } from '@/types';

const sessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: 'buymetokens_session',
};

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Get session
  const session = await getIronSession<SessionData>(
    request,
    response,
    sessionOptions
  );

  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!session.isLoggedIn || !session.userId) {
      // Redirect to home with redirect parameter
      const url = new URL('/', request.url);
      url.searchParams.set('redirect', request.nextUrl.pathname);
      url.searchParams.set('error', 'auth_required');
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
