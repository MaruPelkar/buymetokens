import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RepoCard } from '@/components/profile/RepoCard';

async function getProfileData(username: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/profiles/${username}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    return null;
  }

  return res.json();
}

export default async function ProfilePage({
  params,
}: {
  params: { username: string };
}) {
  const data = await getProfileData(params.username);

  if (!data) {
    notFound();
  }

  const { profile, repos } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <a href="/" className="text-xl font-bold text-gray-900">
            BuyMeTokens
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Profile Header */}
        <Card className="mb-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Avatar */}
            {profile.avatar_url && (
              <div className="flex-shrink-0">
                <Image
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  width={120}
                  height={120}
                  className="rounded-full"
                />
              </div>
            )}

            {/* Profile Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {profile.display_name}
              </h1>
              <p className="text-lg text-gray-600 mb-4">@{profile.github_username}</p>

              {profile.tagline && (
                <p className="text-xl text-gray-700 mb-4">{profile.tagline}</p>
              )}

              {profile.bio && (
                <p className="text-gray-600 leading-relaxed mb-6">{profile.bio}</p>
              )}

              {/* Social Links */}
              {profile.social_links && (
                <div className="flex gap-4 mb-6">
                  {profile.social_links.website && (
                    <a
                      href={profile.social_links.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-gray-900"
                    >
                      🌐 Website
                    </a>
                  )}
                  {profile.social_links.twitter && (
                    <a
                      href={profile.social_links.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-gray-900"
                    >
                      🐦 Twitter
                    </a>
                  )}
                  {profile.social_links.linkedin && (
                    <a
                      href={profile.social_links.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-gray-900"
                    >
                      💼 LinkedIn
                    </a>
                  )}
                </div>
              )}

              {/* Support Button */}
              <Button size="lg" className="mb-4">
                {profile.donation_message || 'Support my work with AI credits'}
              </Button>

              <p className="text-sm text-gray-500">
                {profile.view_count} profile views
              </p>
            </div>
          </div>
        </Card>

        {/* GitHub Projects */}
        {repos && repos.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Featured Projects
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {repos.map((repo: any) => (
                <RepoCard key={repo.id} repo={repo} />
              ))}
            </div>
          </div>
        )}

        {/* GitHub Link */}
        <div className="text-center">
          <a
            href={`https://github.com/${profile.github_username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            View full GitHub profile →
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-20">
        <div className="max-w-4xl mx-auto px-4 py-8 text-center text-gray-600">
          <p>Powered by BuyMeTokens</p>
        </div>
      </footer>
    </div>
  );
}
