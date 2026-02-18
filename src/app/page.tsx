import { GithubButton } from '@/components/auth/GithubButton';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-2xl font-bold text-gray-900">BuyMeTokens</div>
          <GithubButton />
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
          Showcase Your Work.
          <br />
          <span className="text-yellow-500">Get Supported.</span>
        </h1>
        <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
          Create a beautiful profile page connected to your GitHub. Let supporters
          help fund your developer journey with AI credits.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <GithubButton />
          <Link href="/marupelkar">
            <Button variant="outline" size="lg">
              View Example Profile
            </Button>
          </Link>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-yellow-400 w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Connect GitHub
              </h3>
              <p className="text-gray-600">
                Sign in with GitHub and sync your repositories and contributions
                automatically.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-yellow-400 w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Customize Profile
              </h3>
              <p className="text-gray-600">
                Use AI to generate your bio or write your own. Add social links and
                showcase your best projects.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-yellow-400 w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Share & Grow
              </h3>
              <p className="text-gray-600">
                Share your profile link. Let people support your work and help you
                access AI tools.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Built for Developers
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="flex gap-4">
              <div className="text-3xl">🚀</div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  GitHub Integration
                </h3>
                <p className="text-gray-600">
                  Automatically sync your repos, contributions, and profile data.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="text-3xl">🤖</div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  AI-Powered Bios
                </h3>
                <p className="text-gray-600">
                  Generate compelling profile descriptions based on your work.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="text-3xl">🎨</div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Beautiful Profiles
                </h3>
                <p className="text-gray-600">
                  Clean, professional pages that showcase your best projects.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="text-3xl">⚡</div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Lightning Fast
                </h3>
                <p className="text-gray-600">
                  Set up your profile in minutes. No complex configuration needed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-yellow-400 py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-gray-800 mb-8">
            Join developers showcasing their work and building in public.
          </p>
          <GithubButton />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-400">
            Built with Next.js, powered by AI
          </p>
        </div>
      </footer>
    </div>
  );
}
