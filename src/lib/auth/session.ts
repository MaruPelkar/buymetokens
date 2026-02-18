import { getIronSession, IronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { SessionData } from '@/types';

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: 'buymetokens_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function requireAuth(): Promise<SessionData> {
  const session = await getSession();

  if (!session.isLoggedIn || !session.userId) {
    throw new Error('Unauthorized');
  }

  return session as SessionData;
}

export async function createSession(data: Omit<SessionData, 'isLoggedIn'>) {
  const session = await getSession();

  session.userId = data.userId;
  session.email = data.email;
  session.username = data.username;
  session.isLoggedIn = true;

  await session.save();
}

export async function destroySession() {
  const session = await getSession();
  session.destroy();
}
