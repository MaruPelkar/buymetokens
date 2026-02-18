'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface ProfileData {
  slug: string;
  display_name: string;
  tagline: string | null;
  bio: string | null;
  donation_message: string | null;
  minimum_donation: number;
  suggested_amounts: number[];
}

interface SlugStatus {
  available: boolean;
  valid: boolean;
  error?: string;
}

export default function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [slug, setSlug] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [tagline, setTagline] = useState('');
  const [bio, setBio] = useState('');
  const [donationMessage, setDonationMessage] = useState('');
  const [minimumDonation, setMinimumDonation] = useState('');
  const [slugStatus, setSlugStatus] = useState<SlugStatus | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d: ProfileData) => {
        setData(d);
        setSlug(d.slug ?? '');
        setDisplayName(d.display_name ?? '');
        setTagline(d.tagline ?? '');
        setBio(d.bio ?? '');
        setDonationMessage(d.donation_message ?? '');
        setMinimumDonation(String(d.minimum_donation ?? 1));
      })
      .catch(() => setError('Failed to load profile'));
  }, []);

  const checkSlug = useCallback(async (value: string) => {
    if (!value || value === data?.slug) { setSlugStatus(null); return; }
    setSlugChecking(true);
    try {
      const res = await fetch(`/api/profile/slug-check?slug=${encodeURIComponent(value)}`);
      setSlugStatus(await res.json());
    } finally {
      setSlugChecking(false);
    }
  }, [data?.slug]);

  useEffect(() => {
    const timer = setTimeout(() => { checkSlug(slug); }, 400);
    return () => clearTimeout(timer);
  }, [slug, checkSlug]);

  async function handleSave() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slug || undefined,
          display_name: displayName || undefined,
          tagline: tagline || undefined,
          bio: bio || undefined,
          donation_message: donationMessage || undefined,
          minimum_donation: parseFloat(minimumDonation) || 1,
          suggested_amounts: data?.suggested_amounts,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to save');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!data && !error) {
    return <div className="text-gray-500 text-sm">Loading…</div>;
  }

  const slugChanged = slug !== data?.slug;
  const slugBlocked = slugChanged && slugStatus != null && (!slugStatus.valid || !slugStatus.available);

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-sm text-gray-500 mt-1">
          Changes are reflected on your public page immediately.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}
      {saved && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          Profile saved.
        </div>
      )}

      <div className="space-y-5">
        <Input
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <div>
          <Input
            label="Profile slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            helperText={
              slugChecking
                ? 'Checking…'
                : !slugChanged
                ? `Your profile: ${process.env.NEXT_PUBLIC_APP_URL}/${slug}`
                : slugStatus?.available === true
                ? 'Available'
                : slugStatus?.available === false
                ? 'Already taken'
                : undefined
            }
            error={
              slugChanged && slugStatus?.valid === false ? slugStatus.error : undefined
            }
          />
        </div>

        <Input
          label="Tagline"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          maxLength={120}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
          />
        </div>

        <Input
          label="Donation message"
          value={donationMessage}
          onChange={(e) => setDonationMessage(e.target.value)}
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

        <Button
          fullWidth
          onClick={handleSave}
          disabled={saving || slugBlocked}
        >
          {saving ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </div>
  );
}
