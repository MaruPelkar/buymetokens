import { requireAuth } from '@/lib/auth/session';
import { query } from '@/lib/db/client';
import Link from 'next/link';

const PAGE_SIZE = 20;

interface Transaction {
  id: string;
  type: string;
  amount: number;
  net_amount: number;
  platform_fee: number | null;
  stripe_fee: number | null;
  status: string;
  donor_name: string | null;
  donor_email: string | null;
  is_anonymous: boolean;
  message: string | null;
  created_at: string;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requireAuth();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  const [txResult, countResult] = await Promise.all([
    query<Transaction>(
      `SELECT id, type, amount, net_amount, platform_fee, stripe_fee, status,
              donor_name, donor_email, is_anonymous, message, created_at
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [session.userId, PAGE_SIZE, offset]
    ),
    query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM transactions WHERE user_id = $1',
      [session.userId]
    ),
  ]);

  const transactions = txResult.rows;
  const total = parseInt(countResult.rows[0]?.count ?? '0', 10);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>

      {transactions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No transactions yet.</p>
          <p className="text-sm text-gray-400 mt-1">
            Share your profile to receive your first donation.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Donor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Message</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Net</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {tx.is_anonymous ? (
                        <span className="text-gray-400 italic">Anonymous</span>
                      ) : (
                        tx.donor_name ?? tx.donor_email ?? '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate">
                      {tx.message ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      ${parseFloat(String(tx.amount)).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">
                      +${parseFloat(String(tx.net_amount)).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        tx.status === 'completed'
                          ? 'bg-green-50 text-green-700'
                          : tx.status === 'pending'
                          ? 'bg-yellow-50 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              {page > 1 && (
                <Link
                  href={`/dashboard/transactions?page=${page - 1}`}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                >
                  Previous
                </Link>
              )}
              <span className="px-4 py-2 text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/dashboard/transactions?page=${page + 1}`}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
