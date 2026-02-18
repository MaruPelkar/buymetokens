'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';

export default function ProfileEditorPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [profile, setProfile] = useState({
    slug: '',
    bio: '',
    tagline: '',
    ai_generated_bio: '',
    social_links: {
      website: '',
      twitter: '',
      linkedin: '',
    },
    donation_message: 'Support my work with AI credits!',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch('/api/profiles/me');
      if (res.ok) {
        const data = await res.json();
        setProfile({
          slug: data.slug || '',
          bio: data.bio || '',
          tagline: data.tagline || '',
          ai_generated_bio: data.ai_generated_bio || '',
          social_links: data.social_links || { website: '', twitter: '', linkedin: '' },
          donation_message: data.donation_message || 'Support my work with AI credits!',
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncGitHub() {
    setSyncing(true);
    setMessage(null);

    try {
      const res = await fetch('/api/github/sync', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setMessage({
          type: 'success',
          text: `Synced ${data.data.repos} repositories and ${data.data.contributions} contributions!`,
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to sync GitHub data' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to sync GitHub data' });
    } finally {
      setSyncing(false);
    }
  }

  async function handleGenerateBio() {
    setGenerating(true);
    setMessage(null);

    try {
      const res = await fetch('/api/ai/generate-bio', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setProfile((prev) => ({
          ...prev,
          ai_generated_bio: data.data.bio,
          tagline: data.data.tagline,
        }));
        setMessage({ type: 'success', text: 'Bio and tagline generated successfully!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to generate bio' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to generate bio' });
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/profiles/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update profile' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  }

  function useAIBio() {
    setProfile((prev) => ({ ...prev, bio: prev.ai_generated_bio }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Edit Profile</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* GitHub Sync */}
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">GitHub Data</h2>
          <p className="text-gray-600 mb-4">
            Sync your latest repositories and contribution data from GitHub.
          </p>
          <Button onClick={handleSyncGitHub} disabled={syncing} variant="outline">
            {syncing ? 'Syncing...' : 'Sync GitHub Data'}
          </Button>
        </Card>

        {/* Basic Info */}
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
          <div className="space-y-4">
            <Input
              label="Username (URL slug)"
              value={profile.slug}
              onChange={(e) => setProfile({ ...profile, slug: e.target.value.toLowerCase() })}
              placeholder="your-username"
              helperText="Your profile will be available at /your-username"
            />

            <Input
              label="Tagline"
              value={profile.tagline}
              onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
              placeholder="Full-stack developer passionate about AI"
              maxLength={255}
            />
          </div>
        </Card>

        {/* AI Bio Generator */}
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">AI Bio Generator</h2>
          <p className="text-gray-600 mb-4">
            Generate a professional bio based on your GitHub activity using AI.
          </p>
          <Button onClick={handleGenerateBio} disabled={generating} variant="outline">
            {generating ? 'Generating...' : 'Generate Bio with AI'}
          </Button>

          {profile.ai_generated_bio && (
            <div className="mt-4">
              <div className="bg-gray-50 p-4 rounded-lg mb-2">
                <p className="text-gray-700">{profile.ai_generated_bio}</p>
              </div>
              <Button size="sm" onClick={useAIBio} variant="ghost">
                Use this bio
              </Button>
            </div>
          )}
        </Card>

        {/* Bio */}
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Bio</h2>
          <Textarea
            value={profile.bio}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            placeholder="Tell people about yourself and what you're working on..."
            rows={5}
            maxLength={500}
          />
          <p className="mt-2 text-sm text-gray-500">
            {profile.bio.length}/500 characters
          </p>
        </Card>

        {/* Social Links */}
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Social Links</h2>
          <div className="space-y-4">
            <Input
              label="Website"
              value={profile.social_links.website}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  social_links: { ...profile.social_links, website: e.target.value },
                })
              }
              placeholder="https://yourwebsite.com"
              type="url"
            />

            <Input
              label="Twitter"
              value={profile.social_links.twitter}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  social_links: { ...profile.social_links, twitter: e.target.value },
                })
              }
              placeholder="https://twitter.com/yourhandle"
              type="url"
            />

            <Input
              label="LinkedIn"
              value={profile.social_links.linkedin}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  social_links: { ...profile.social_links, linkedin: e.target.value },
                })
              }
              placeholder="https://linkedin.com/in/yourprofile"
              type="url"
            />
          </div>
        </Card>

        {/* Donation Message */}
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Support Button Text</h2>
          <Input
            value={profile.donation_message}
            onChange={(e) =>
              setProfile({ ...profile, donation_message: e.target.value })
            }
            placeholder="Support my work with AI credits!"
            maxLength={500}
          />
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
