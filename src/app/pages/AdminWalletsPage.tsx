import { useEffect, useMemo, useState } from "react";
import { CreditCard } from "lucide-react";
import { getAdminUsers, type UserWalletSummaryRow } from "../../lib/supabase-data";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatAmount(value: number) {
  return numberFormatter.format(value);
}

export function AdminWalletsPage() {
  const [rows, setRows] = useState<UserWalletSummaryRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getAdminUsers(100)
      .then((data) => {
        if (active) {
          setRows(data.filter((entry) => entry.role === "user"));
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load wallet data.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.balance += Number(row.balance ?? 0);
          acc.earned += Number(row.lifetime_earned ?? 0);
          acc.spent += Number(row.lifetime_spent ?? 0);
          return acc;
        },
        { balance: 0, earned: 0, spent: 0 },
      ),
    [rows],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-emerald-200" />
          <h2 className="text-2xl font-semibold tracking-tight">Wallet oversight</h2>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
          Review total wallet exposure, earned balances, and spend history across every managed user account.
        </p>
      </section>

      {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total balance", value: `${formatAmount(totals.balance)} SLT` },
          { label: "Lifetime earned", value: `${formatAmount(totals.earned)} SLT` },
          { label: "Lifetime spent", value: `${formatAmount(totals.spent)} SLT` },
        ].map((item) => (
          <div key={item.label} className="rounded-[1.8rem] border border-white/10 bg-white/5 p-6">
            <p className="text-3xl font-semibold text-white">{item.value}</p>
            <p className="mt-2 text-sm text-white/55">{item.label}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.18em] text-white/42">
                <th className="px-0 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Lifetime Earned</th>
                <th className="px-4 py-3">Lifetime Spent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr key={entry.user_id} className="border-b border-white/6 text-sm last:border-b-0">
                  <td className="px-0 py-4 text-white">{entry.full_name || "Unnamed user"}</td>
                  <td className="px-4 py-4 capitalize text-white/62">{entry.role}</td>
                  <td className="px-4 py-4 capitalize text-white/62">{entry.status}</td>
                  <td className="px-4 py-4 text-white">{formatAmount(Number(entry.balance))} SLT</td>
                  <td className="px-4 py-4 text-white/62">{formatAmount(Number(entry.lifetime_earned))} SLT</td>
                  <td className="px-4 py-4 text-white/62">{formatAmount(Number(entry.lifetime_spent))} SLT</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
