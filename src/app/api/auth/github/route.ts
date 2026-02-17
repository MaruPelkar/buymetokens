import { NextResponse } from 'next/server';

export async function GET() {
  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');

  githubAuthUrl.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID!);
  githubAuthUrl.searchParams.set('scope', 'read:user user:email read:org');
  githubAuthUrl.searchParams.set(
    'redirect_uri',
    process.env.GITHUB_CALLBACK_URL || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`
  );

  return NextResponse.redirect(githubAuthUrl.toString());
}
