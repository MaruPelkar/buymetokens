import { requireAuth } from '@/lib/auth/session';
import { query } from '@/lib/db/client';
import Link from 'next/link';

async function getDashboardData(userId: string) {
  const [balanceResult, txResult] = await Promise.all([
    query(
      `SELECT b.available_balance, b.lifetime_received,
              pk.key_prefix, pk.synced_limit_remaining, pk.last_synced_at
       FROM balances b
       LEFT JOIN provisioned_keys pk ON pk.user_id = b.user_id AND pk.is_active = true
       WHERE b.user_id = $1 LIMIT 1`,
      [userId]
    ),
    query(
      `SELECT type, net_amount, donor_name, is_anonymous, created_at
       FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [userId]
    ),
  ]);

  return {
    balance: balanceResult.rows[0] ?? null,
    recentTransactions: txResult.rows,
  };
}

async function getProfile(userId: string) {
  const result = await query<{ slug: string; display_name: string }>(
    `SELECT p.slug, u.display_name FROM profiles p JOIN users u ON p.user_id = u.id WHERE p.user_id = $1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export default async function DashboardPage() {
  const session = await requireAuth();
  const [{ balance, recentTransactions }, profile] = await Promise.all([
    getDashboardData(session.userId),
    getProfile(session.userId),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const profileUrl = profile?.slug ? `${appUrl}/${profile.slug}` : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back{profile?.display_name ? `, ${profile.display_name}` : ''}
        </h1>
        <p className="text-gray-500 text-sm mt-1">Here&apos;s what&apos;s happening.</p>
      </div>

      {/* Balance card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <p className="text-sm font-medium text-gray-500 mb-1">Available balance</p>
        <p className="text-4xl font-bold text-gray-900">
          ${parseFloat(balance?.available_balance ?? '0').toFixed(2)}
        </p>
        {balance?.key_prefix ? (
          <p className="text-sm text-gray-500 mt-2">
            OpenRouter key: <span className="font-mono">{balance.key_prefix}</span>
            {balance.last_synced_at && (
              <span className="ml-2 text-gray-400">
                · synced {new Date(balance.last_synced_at).toLocaleString()}
              </span>
            )}
          </p>
        ) : (
          <p className="text-sm text-yellow-600 mt-2">
            <Link href="/dashboard/api-keys" className="underline">
              Create an API key
            </Link>{' '}
            to start using your balance.
          </p>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Quick setup */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Quick setup</h2>
          <p className="text-sm text-gray-600 mb-3">
            Point your code at OpenRouter:
          </p>
          <pre className="bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-800 overflow-x-auto">
{`OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_API_KEY=<your key>`}
          </pre>
          <p className="text-xs text-gray-500 mt-2">
            Get your key from{' '}
            <Link href="/dashboard/api-keys" className="underline text-yellow-600">
              API Keys
            </Link>
            .
          </p>
        </div>

        {/* Share profile */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Share your profile</h2>
          {profileUrl ? (
            <>
              <p className="text-sm text-gray-600 mb-3">
                Share this link so supporters can fund your AI credits:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-xs font-mono text-gray-800 truncate">
                  {profileUrl}
                </code>
                <CopyButton text={profileUrl} />
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-600">
              <Link href="/dashboard/onboarding" className="underline text-yellow-600">
                Complete onboarding
              </Link>{' '}
              to get your public profile link.
            </p>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      {recentTransactions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent transactions</h2>
            <Link
              href="/dashboard/transactions"
              className="text-sm text-yellow-600 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {recentTransactions.map((tx, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-gray-900 font-medium">
                    {tx.is_anonymous
                      ? 'Anonymous'
                      : tx.donor_name ?? 'Someone'}
                  </span>
                  <span className="text-gray-400 ml-2">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </span>
                </div>
                <span className="text-green-600 font-semibold">
                  +${parseFloat(tx.net_amount ?? '0').toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Inline client component for copy button
function CopyButton({ text }: { text: string }) {
  // This needs to be a client component but we're in a server component file.
  // We use a simple button with onClick via a script attribute.
  // Since we can't use 'use client' in a mixed file, render as a plain link instead.
  return (
    <a
      href={text}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 px-3 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-xs font-medium rounded-lg transition-colors"
    >
      Open
    </a>
  );
}
