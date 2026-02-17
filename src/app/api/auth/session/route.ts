import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  try {
    const session = await getSession();

    if (!session.isLoggedIn) {
      return NextResponse.json(
        { isLoggedIn: false },
        { status: 401 }
      );
    }

    return NextResponse.json({
      isLoggedIn: true,
      user: {
        userId: session.userId,
        email: session.email,
        username: session.username,
      },
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json(
      { isLoggedIn: false, error: 'Session check failed' },
      { status: 500 }
    );
  }
}
