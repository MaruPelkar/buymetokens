import { requireAuth } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireAuth();
  } catch {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 px-6 py-8 max-w-5xl">
        {children}
      </main>
    </div>
  );
}
