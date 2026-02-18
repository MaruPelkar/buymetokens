import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeCodeForToken,
  getGitHubUser,
  getGitHubEmails,
  findOrCreateUser,
} from '@/lib/auth/github';
import { createSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // Handle OAuth error
  if (error) {
    console.error('GitHub OAuth error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?error=auth_failed`
    );
  }

  // Handle missing code
  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?error=missing_code`
    );
  }

  try {
    // Exchange code for access token
    const accessToken = await exchangeCodeForToken(code);

    // Fetch GitHub user profile
    const githubUser = await getGitHubUser(accessToken);

    // Fetch GitHub emails to get primary/verified email
    const emails = await getGitHubEmails(accessToken);
    const primaryEmail =
      emails.find((e) => e.primary && e.verified)?.email ||
      emails.find((e) => e.verified)?.email ||
      githubUser.email;

    if (!primaryEmail) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/?error=no_email`
      );
    }

    // Create or update user in database
    const user = await findOrCreateUser(githubUser, accessToken, primaryEmail);

    // Create session
    await createSession({
      userId: user.id,
      email: user.email,
      username: user.github_username,
    });

    // Redirect to dashboard or onboarding
    const redirectTo = user.onboarding_completed
      ? '/dashboard'
      : '/dashboard/onboarding';

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}${redirectTo}`);
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?error=auth_error`
    );
  }
}
