import { GithubButton } from '@/components/auth/GithubButton';
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

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
          Support developers.
          <br />
          <span className="text-yellow-500">Fund their AI.</span>
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          Donors pay in USD. Developers get OpenRouter credits they can use
          immediately — no account switching, no copy-paste keys, just more
          tokens to build with.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <GithubButton />
          <Link
            href="#how-it-works"
            className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium border-2 border-gray-900 text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
          >
            How it works
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-gray-50 py-20">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-14">
            Three steps. That&apos;s it.
          </h2>
          <div className="grid md:grid-cols-3 gap-10">
            <div className="text-center">
              <div className="bg-yellow-400 w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-5">
                1
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Donor sends money
              </h3>
              <p className="text-gray-600">
                They visit your profile, choose an amount, and pay with a card.
                No account needed.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-yellow-400 w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-5">
                2
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Your balance grows
              </h3>
              <p className="text-gray-600">
                We take 5% + Stripe&apos;s fee. The rest lands in your
                OpenRouter spending limit instantly.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-yellow-400 w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-5">
                3
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                You build with AI
              </h3>
              <p className="text-gray-600">
                Use your provisioned OpenRouter key. Access GPT-4, Claude,
                Gemini — whatever you need.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Developer value props */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Built for developers
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex gap-4">
              <div className="text-2xl">🔑</div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  One key, every model
                </h3>
                <p className="text-gray-600 text-sm">
                  A single OpenRouter key gives you access to 200+ models.
                  Point your base URL at OpenRouter and you&apos;re done.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="text-2xl">⚡</div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  Instant top-up
                </h3>
                <p className="text-gray-600 text-sm">
                  Donations go directly to your OpenRouter spending limit.
                  No delays, no manual transfers.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="text-2xl">🛡️</div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  Zero financial risk
                </h3>
                <p className="text-gray-600 text-sm">
                  You only spend what supporters fund. OpenRouter enforces your
                  limit — you can&apos;t accidentally overspend.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="text-2xl">📊</div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  Full transparency
                </h3>
                <p className="text-gray-600 text-sm">
                  See every donation, your current balance, and usage — all
                  from your dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-yellow-400 py-20">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Set up in 2 minutes
          </h2>
          <p className="text-lg text-gray-800 mb-8">
            Sign in with GitHub, choose a slug, share your link.
          </p>
          <GithubButton />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span className="font-semibold">BuyMeTokens</span>
          <div className="flex gap-6 text-sm text-gray-400">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
