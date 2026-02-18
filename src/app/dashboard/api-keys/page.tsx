'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';

interface ProvisionedKey {
  id: string;
  key_name: string;
  key_prefix: string;
  is_active: boolean;
  synced_limit_remaining: number;
  synced_usage: number;
  last_synced_at: string | null;
  created_at: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ProvisionedKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Revealed key
  const [plaintext, setPlaintext] = useState('');
  const [keyCopied, setKeyCopied] = useState(false);

  async function fetchKeys() {
    try {
      const res = await fetch('/api/api-keys');
      const data = await res.json();
      setKeys(data.keys ?? []);
    } catch {
      setError('Failed to load keys');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchKeys(); }, []);

  async function handleCreate() {
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Default' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create key');
      setPlaintext(data.plaintext);
      setKeyCopied(false);
      await fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    if (!confirm('Revoke this key? Any code using it will stop working immediately.')) return;
    setRevoking(keyId);
    setError('');
    try {
      const res = await fetch(`/api/api-keys/${keyId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to revoke key');
      }
      await fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke');
    } finally {
      setRevoking(null);
    }
  }

  const activeKey = keys.find((k) => k.is_active);

  if (loading) return <div className="text-sm text-gray-500">Loading…</div>;

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
        {!activeKey && (
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating…' : 'Create key'}
          </Button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Key reveal modal */}
      {plaintext && (
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-2xl p-6 space-y-4">
          <div>
            <p className="font-semibold text-gray-900 mb-1">Save this key now</p>
            <p className="text-sm text-gray-600">
              This key is shown <span className="font-semibold text-red-600">once only</span>.
              It cannot be retrieved again.
            </p>
          </div>
          <div className="bg-white rounded-lg border border-yellow-300 p-4">
            <code className="text-sm font-mono break-all text-gray-800">{plaintext}</code>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => {
                navigator.clipboard.writeText(plaintext);
                setKeyCopied(true);
              }}
            >
              {keyCopied ? 'Copied!' : 'Copy key'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setPlaintext('')}
              disabled={!keyCopied}
            >
              {keyCopied ? 'Done' : 'Copy the key first'}
            </Button>
          </div>
        </div>
      )}

      {/* Key list */}
      {keys.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 mb-4">No API keys yet.</p>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating…' : 'Create your first key'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {keys.map((key) => (
            <div
              key={key.id}
              className="bg-white rounded-2xl border border-gray-200 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{key.key_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      key.is_active
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {key.is_active ? 'Active' : 'Revoked'}
                    </span>
                  </div>
                  <code className="text-sm font-mono text-gray-600 block">{key.key_prefix}</code>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>
                      Remaining:{' '}
                      <span className="font-medium text-gray-900">
                        ${parseFloat(String(key.synced_limit_remaining)).toFixed(2)}
                      </span>
                    </span>
                    <span>
                      Used:{' '}
                      <span className="font-medium text-gray-900">
                        ${parseFloat(String(key.synced_usage)).toFixed(4)}
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Created {new Date(key.created_at).toLocaleDateString()}
                    {key.last_synced_at && (
                      <> · synced {new Date(key.last_synced_at).toLocaleString()}</>
                    )}
                  </p>
                </div>
                {key.is_active && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevoke(key.id)}
                    disabled={revoking === key.id}
                    className="text-red-600 hover:bg-red-50 shrink-0"
                  >
                    {revoking === key.id ? 'Revoking…' : 'Revoke'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
        <p className="font-medium text-gray-700 mb-1">How to use</p>
        <p>
          Set{' '}
          <code className="font-mono bg-white px-1 rounded">OPENAI_API_KEY</code> to
          your key and{' '}
          <code className="font-mono bg-white px-1 rounded">OPENAI_BASE_URL</code> to{' '}
          <code className="font-mono bg-white px-1 rounded">
            https://openrouter.ai/api/v1
          </code>
          . Works with any OpenAI-compatible SDK.
        </p>
      </div>
    </div>
  );
}
