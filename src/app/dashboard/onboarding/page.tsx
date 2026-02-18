'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Step = 1 | 2;

interface SlugStatus {
  available: boolean;
  valid: boolean;
  error?: string;
}

export default function OnboardingPage() {
  const router = useRouter();

  // Step 1
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [bio, setBio] = useState('');

  // Slug availability
  const [slugStatus, setSlugStatus] = useState<SlugStatus | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);

  // Step 2
  const [donationMessage, setDonationMessage] = useState('');
  const [minimumDonation, setMinimumDonation] = useState('1');
  const [suggestedAmounts, setSuggestedAmounts] = useState<number[]>([3, 5, 10, 25]);
  const [newAmount, setNewAmount] = useState('');

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Key reveal modal
  const [plaintext, setPlaintext] = useState('');
  const [keyCopied, setKeyCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Prefill from session
  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => {
        if (data.display_name) setDisplayName(data.display_name);
        if (data.slug) setSlug(data.slug);
      })
      .catch(() => {});
  }, []);

  const checkSlug = useCallback(async (value: string) => {
    if (!value) { setSlugStatus(null); return; }
    setSlugChecking(true);
    try {
      const res = await fetch(`/api/profile/slug-check?slug=${encodeURIComponent(value)}`);
      const data = await res.json();
      setSlugStatus(data);
    } finally {
      setSlugChecking(false);
    }
  }, []);

  // Debounce slug check
  useEffect(() => {
    const timer = setTimeout(() => { checkSlug(slug); }, 400);
    return () => clearTimeout(timer);
  }, [slug, checkSlug]);

  function addSuggestedAmount() {
    const n = parseFloat(newAmount);
    if (!n || n <= 0) return;
    setSuggestedAmounts((prev) => [...new Set([...prev, n])].sort((a, b) => a - b));
    setNewAmount('');
  }

  function removeSuggestedAmount(amount: number) {
    setSuggestedAmounts((prev) => prev.filter((a) => a !== amount));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      // Save profile
      const profileRes = await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          slug,
          tagline: tagline || undefined,
          bio: bio || undefined,
          donation_message: donationMessage || undefined,
          minimum_donation: parseFloat(minimumDonation) || 1,
          suggested_amounts: suggestedAmounts,
          onboarding_completed: true,
        }),
      });

      if (!profileRes.ok) {
        const data = await profileRes.json();
        throw new Error(data.error ?? 'Failed to save profile');
      }

      // Create API key
      const keyRes = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Default' }),
      });

      if (keyRes.ok) {
        const keyData = await keyRes.json();
        setPlaintext(keyData.plaintext ?? '');
        setShowKey(true);
      } else {
        // Key creation failed (might already exist) — just go to dashboard
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopyKey() {
    navigator.clipboard.writeText(plaintext);
    setKeyCopied(true);
  }

  if (showKey) {
    return (
      <div className="max-w-lg mx-auto py-16">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-6">
          <div className="text-4xl">🔑</div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Save your API key</h2>
            <p className="text-sm text-gray-600">
              This key is shown{' '}
              <span className="font-semibold text-red-600">once only</span>. Copy it
              now — you cannot retrieve it again.
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <code className="text-sm font-mono break-all text-gray-800">{plaintext}</code>
          </div>
          <div className="space-y-3">
            <Button fullWidth onClick={handleCopyKey}>
              {keyCopied ? 'Copied!' : 'Copy key'}
            </Button>
            <Button
              fullWidth
              variant="outline"
              onClick={() => router.push('/dashboard')}
              disabled={!keyCopied}
            >
              I&apos;ve saved my key — Go to dashboard
            </Button>
          </div>
          {!keyCopied && (
            <p className="text-xs text-gray-400">Copy the key first to continue.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded ${s <= step ? 'bg-yellow-400' : 'bg-gray-200'}`}
            />
          ))}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {step === 1 ? 'Set up your profile' : 'Donation preferences'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">Step {step} of 2</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <Input
            label="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Navneet Jain"
          />

          <div>
            <Input
              label="Profile URL slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="navneet"
              helperText={
                slugChecking
                  ? 'Checking…'
                  : slugStatus?.valid === false
                  ? undefined
                  : slugStatus?.available === true
                  ? `Available: ${process.env.NEXT_PUBLIC_APP_URL}/${slug}`
                  : slugStatus?.available === false
                  ? 'Already taken'
                  : undefined
              }
              error={
                slugStatus?.valid === false ? slugStatus.error : undefined
              }
            />
          </div>

          <Input
            label="Tagline (optional)"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Building open-source AI tools"
            maxLength={120}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bio (optional)
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A bit about yourself and what you're building…"
              rows={4}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent placeholder:text-gray-400"
            />
          </div>

          <Button
            fullWidth
            onClick={() => setStep(2)}
            disabled={!displayName || !slug || slugStatus?.available !== true}
          >
            Continue
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <Input
            label="Donation message (optional)"
            value={donationMessage}
            onChange={(e) => setDonationMessage(e.target.value)}
            placeholder="Buy me some tokens to keep the lights on!"
            maxLength={200}
          />

          <Input
            label="Minimum donation ($)"
            type="number"
            min="0"
            step="0.01"
            value={minimumDonation}
            onChange={(e) => setMinimumDonation(e.target.value)}
          />

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Suggested amounts
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {suggestedAmounts.map((a) => (
                <span
                  key={a}
                  className="flex items-center gap-1 px-3 py-1 bg-yellow-50 text-yellow-800 rounded-full text-sm font-medium"
                >
                  ${a}
                  <button
                    onClick={() => removeSuggestedAmount(a)}
                    className="ml-1 text-yellow-600 hover:text-yellow-800 leading-none"
                    aria-label={`Remove $${a}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add amount"
                type="number"
                min="1"
                step="1"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSuggestedAmount()}
              />
              <Button variant="outline" onClick={addSuggestedAmount}>
                Add
              </Button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button fullWidth onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Setting up…' : 'Finish setup'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
