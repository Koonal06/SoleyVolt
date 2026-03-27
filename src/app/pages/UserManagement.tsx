import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getAdminUsers, type UserWalletSummaryRow } from "../../lib/supabase-data";
import { sendAdminPasswordReset } from "../../lib/server-api";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatAmount(value: number) {
  return numberFormatter.format(value);
}

export function UserManagement() {
  const [users, setUsers] = useState<UserWalletSummaryRow[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);

  const getResetRedirectUrl = () => `${window.location.origin}/auth/reset`;

  useEffect(() => {
    let active = true;

    getAdminUsers(50)
      .then((data) => {
        if (active) {
          setUsers(data);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load user management data.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) {
      return users;
    }

    return users.filter((user) => {
      const name = user.full_name?.toLowerCase() ?? "";
      return name.includes(term) || user.user_id.toLowerCase().includes(term);
    });
  }, [query, users]);

  const handleSendReset = async (userId: string) => {
    try {
      setResettingUserId(userId);
      const { email } = await sendAdminPasswordReset(userId, getResetRedirectUrl());
      toast.success(`Password reset link sent to ${email}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to send password reset link.");
    } finally {
      setResettingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <h2 className="text-2xl font-semibold tracking-tight">User management</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
          Review wallet exposure, language settings, account role, and account status across the full user base.
        </p>
      </section>

      {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or user id"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 sm:max-w-sm"
          />
          <p className="text-sm text-white/52">{filteredUsers.length} visible records</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.18em] text-white/42">
                <th className="px-0 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">User Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Language</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Lifetime Earned</th>
                <th className="px-4 py-3">Lifetime Spent</th>
                <th className="px-4 py-3">Energy In</th>
                <th className="px-4 py-3">Energy Out</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.user_id} className="border-b border-white/6 text-sm last:border-b-0">
                    <td className="px-0 py-4">
                      <div>
                        <p className="font-medium text-white">{user.full_name || "Unnamed user"}</p>
                        <p className="mt-1 text-xs text-white/38">{user.user_id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 capitalize text-white/62">{user.role}</td>
                    <td className="px-4 py-4 capitalize text-white/62">{user.user_type ?? "prosumer"}</td>
                    <td className="px-4 py-4 capitalize text-white/62">{user.status}</td>
                    <td className="px-4 py-4 uppercase text-white/62">{user.language}</td>
                    <td className="px-4 py-4 text-white">{formatAmount(Number(user.balance))} SLT</td>
                    <td className="px-4 py-4 text-white/62">{formatAmount(Number(user.lifetime_earned))} SLT</td>
                    <td className="px-4 py-4 text-white/62">{formatAmount(Number(user.lifetime_spent))} SLT</td>
                    <td className="px-4 py-4 text-white/62">{formatAmount(Number(user.total_imported_kwh))} kWh</td>
                    <td className="px-4 py-4 text-white/62">{formatAmount(Number(user.total_exported_kwh))} kWh</td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => handleSendReset(user.user_id)}
                        disabled={resettingUserId === user.user_id}
                        className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {resettingUserId === user.user_id ? "Sending..." : "Send reset link"}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="px-0 py-12 text-center text-sm text-white/50">
                    {isLoading ? "Loading users..." : "No users match the current search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
