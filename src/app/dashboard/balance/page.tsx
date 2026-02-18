import { requireAuth } from '@/lib/auth/session';
import { query } from '@/lib/db/client';
import Link from 'next/link';

export default async function BalancePage() {
  const session = await requireAuth();

  const result = await query(
    `SELECT b.available_balance, b.lifetime_received, b.currency,
            pk.key_prefix, pk.synced_limit_remaining, pk.synced_usage,
            pk.last_synced_at, pk.key_name
     FROM balances b
     LEFT JOIN provisioned_keys pk ON pk.user_id = b.user_id AND pk.is_active = true
     WHERE b.user_id = $1 LIMIT 1`,
    [session.userId]
  );

  const balance = result.rows[0];
  const available = parseFloat(balance?.available_balance ?? '0');
  const lifetimeReceived = parseFloat(balance?.lifetime_received ?? '0');
  const lastSynced = balance?.last_synced_at
    ? new Date(balance.last_synced_at)
    : null;

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Balance</h1>

      {/* Main balance */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <div>
          <p className="text-sm text-gray-500 mb-1">Available (OpenRouter limit)</p>
          <p className="text-5xl font-bold text-gray-900">${available.toFixed(2)}</p>
          {lastSynced && (
            <p className="text-xs text-gray-400 mt-2">
              Last synced: {lastSynced.toLocaleString()} · syncs hourly
            </p>
          )}
        </div>

        <div className="border-t pt-4">
          <p className="text-sm text-gray-500">Lifetime received</p>
          <p className="text-xl font-semibold text-gray-900">
            ${lifetimeReceived.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Key info */}
      {balance?.key_prefix ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Your OpenRouter key</h2>
          <div>
            <p className="text-xs text-gray-500 mb-1">Key name</p>
            <p className="font-medium text-gray-900">{balance.key_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Key prefix (masked)</p>
            <code className="font-mono text-sm text-gray-800">{balance.key_prefix}</code>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Limit remaining</p>
              <p className="font-semibold text-gray-900">
                ${parseFloat(balance.synced_limit_remaining ?? '0').toFixed(4)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Total usage</p>
              <p className="font-semibold text-gray-900">
                ${parseFloat(balance.synced_usage ?? '0').toFixed(4)}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
          <p className="text-sm text-yellow-800">
            No active API key.{' '}
            <Link href="/dashboard/api-keys" className="underline font-medium">
              Create one
            </Link>{' '}
            to use your balance.
          </p>
        </div>
      )}

      {/* Setup instructions */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">How to use your balance</h2>
        <p className="text-sm text-gray-600">
          Point your code at OpenRouter. Replace your existing key with your
          BuyMeTokens provisioned key.
        </p>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Python / OpenAI SDK
          </p>
          <pre className="bg-gray-50 rounded-lg p-4 text-xs font-mono text-gray-800 overflow-x-auto">
{`from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="YOUR_PROVISIONED_KEY",
)

response = client.chat.completions.create(
    model="openai/gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}],
)`}
          </pre>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            TypeScript / Node.js
          </p>
          <pre className="bg-gray-50 rounded-lg p-4 text-xs font-mono text-gray-800 overflow-x-auto">
{`import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY, // your provisioned key
});`}
          </pre>
        </div>
      </div>
    </div>
  );
}
