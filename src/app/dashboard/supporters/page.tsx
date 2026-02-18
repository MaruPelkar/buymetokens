import { requireAuth } from '@/lib/auth/session';
import { query } from '@/lib/db/client';

interface Supporter {
  donor_name: string | null;
  donor_email: string;
  total_donated_usd: number;
  donation_count: number;
  is_anonymous: boolean;
  last_donated_at: string;
}

export default async function SupportersPage() {
  const session = await requireAuth();

  const result = await query<Supporter>(
    `SELECT donor_name, donor_email, total_donated_usd, donation_count,
            is_anonymous, last_donated_at
     FROM donation_supporters
     WHERE recipient_user_id = $1
     ORDER BY total_donated_usd DESC`,
    [session.userId]
  );

  const supporters = result.rows;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Supporters</h1>
        <p className="text-sm text-gray-500 mt-1">
          {supporters.length} supporter{supporters.length !== 1 ? 's' : ''} total
        </p>
      </div>

      {supporters.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No supporters yet.</p>
          <p className="text-sm text-gray-400 mt-1">
            Share your profile link to start receiving donations.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Supporter</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Donated</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Times</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Last donation</th>
              </tr>
            </thead>
            <tbody>
              {supporters.map((s, i) => {
                const name = s.is_anonymous
                  ? 'Anonymous'
                  : s.donor_name ?? s.donor_email;
                const initials = name
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <tr
                    key={i}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-xs font-bold text-yellow-800 shrink-0">
                          {s.is_anonymous ? '?' : initials}
                        </div>
                        <span className={`font-medium ${s.is_anonymous ? 'text-gray-400 italic' : 'text-gray-900'}`}>
                          {name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">
                      ${parseFloat(String(s.total_donated_usd)).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {s.donation_count}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(s.last_donated_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
