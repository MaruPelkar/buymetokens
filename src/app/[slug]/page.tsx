import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { DonateWidget } from '@/components/donate-widget';

interface PublicProfile {
  slug: string;
  display_name: string;
  avatar_url: string | null;
  github_username: string;
  tagline: string | null;
  bio: string | null;
  donation_message: string | null;
  minimum_donation: number;
  suggested_amounts: number[];
  total_supporters: number;
  total_received_usd: number;
}

async function getProfile(slug: string): Promise<PublicProfile | null> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/public/profile/${slug}`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getProfile(slug);
  if (!profile) return { title: 'Not Found' };

  return {
    title: `${profile.display_name} — BuyMeTokens`,
    description:
      profile.tagline ?? `Support ${profile.display_name} with AI credits.`,
    openGraph: {
      title: `${profile.display_name} — BuyMeTokens`,
      description:
        profile.tagline ?? `Support ${profile.display_name} with AI credits.`,
      images: profile.avatar_url ? [profile.avatar_url] : [],
    },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getProfile(slug);

  if (!profile) notFound();

  const initials = profile.display_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-5 gap-8">
          {/* Profile info */}
          <div className="md:col-span-3 space-y-6">
            <div className="flex items-center gap-4">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  className="w-16 h-16 rounded-full"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-yellow-400 flex items-center justify-center text-xl font-bold text-gray-900">
                  {initials}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {profile.display_name}
                </h1>
                {profile.github_username && (
                  <a
                    href={`https://github.com/${profile.github_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    @{profile.github_username}
                  </a>
                )}
              </div>
            </div>

            {profile.tagline && (
              <p className="text-lg text-gray-700 font-medium">{profile.tagline}</p>
            )}

            {profile.bio && (
              <p className="text-gray-600 leading-relaxed">{profile.bio}</p>
            )}

            {(profile.total_supporters > 0 || profile.total_received_usd > 0) && (
              <div className="flex gap-6 text-sm text-gray-500">
                {profile.total_supporters > 0 && (
                  <span>
                    <span className="font-semibold text-gray-900">
                      {profile.total_supporters}
                    </span>{' '}
                    supporter{profile.total_supporters !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Donate widget */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                {profile.donation_message ?? `Support ${profile.display_name}`}
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Your donation funds AI credits directly.
              </p>
              <DonateWidget profile={profile} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
