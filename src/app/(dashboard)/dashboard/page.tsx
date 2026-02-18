'use client';

import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Welcome Card */}
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Welcome back!
          </h2>
          <p className="text-gray-600 mb-4">
            Manage your developer profile and showcase your GitHub projects.
          </p>
          <Link href="/dashboard/profile">
            <Button variant="primary">Edit Profile</Button>
          </Link>
        </Card>

        {/* Profile Link Card */}
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Your Profile
          </h2>
          <p className="text-gray-600 mb-4">
            Share your profile link with others:
          </p>
          {user?.username && (
            <div className="bg-gray-100 p-3 rounded-lg mb-4">
              <code className="text-sm text-gray-800">
                {process.env.NEXT_PUBLIC_APP_URL || 'https://buymetokens.com'}/
                {user.username}
              </code>
            </div>
          )}
          {user?.username && (
            <Link href={`/${user.username}`} target="_blank">
              <Button variant="outline" fullWidth>
                View Public Profile
              </Button>
            </Link>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Quick Actions
        </h2>
        <div className="space-y-3">
          <Link href="/dashboard/profile">
            <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 border border-gray-200 transition-colors">
              <div className="font-medium text-gray-900">Edit Profile</div>
              <div className="text-sm text-gray-600">
                Update your bio, social links, and settings
              </div>
            </button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
