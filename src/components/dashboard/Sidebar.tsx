'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

const navItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/balance', label: 'Balance' },
  { href: '/dashboard/transactions', label: 'Transactions' },
  { href: '/dashboard/supporters', label: 'Supporters' },
  { href: '/dashboard/api-keys', label: 'API Keys' },
  { href: '/dashboard/profile', label: 'Profile' },
];

export function Sidebar() {
  const pathname = usePathname();

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-gray-200 bg-white min-h-screen">
      <div className="px-4 py-5 border-b border-gray-200">
        <Link href="/" className="text-lg font-bold text-gray-900">
          BuyMeTokens
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'block px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              pathname === item.href
                ? 'bg-yellow-50 text-yellow-700'
                : 'text-gray-700 hover:bg-gray-50'
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-gray-200">
        <button
          onClick={handleSignOut}
          className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
