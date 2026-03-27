import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Coins, Sun } from "lucide-react";
import {
  getAdminOverview,
  getAdminUsers,
  getRecentTransactions,
  type AdminOverviewRow,
  type UserWalletSummaryRow,
  type WalletTransactionRow,
} from "../../lib/supabase-data";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatAmount(value: number) {
  return numberFormatter.format(value);
}

export function TokenMonitoring() {
  const [overview, setOverview] = useState<AdminOverviewRow | null>(null);
  const [users, setUsers] = useState<UserWalletSummaryRow[]>([]);
  const [transactions, setTransactions] = useState<WalletTransactionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([getAdminOverview(), getAdminUsers(25), getRecentTransactions(25)])
      .then(([overviewData, userData, transactionData]) => {
        if (!active) {
          return;
        }

        setOverview(overviewData);
        setUsers(userData);
        setTransactions(transactionData);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load token circulation data.");
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

  const aggregate = useMemo(() => {
    const totalHeld = users.reduce((sum, user) => sum + Number(user.balance), 0);
    const totalEarned = users.reduce((sum, user) => sum + Number(user.lifetime_earned), 0);
    const totalSpent = users.reduce((sum, user) => sum + Number(user.lifetime_spent), 0);
    return { totalHeld, totalEarned, totalSpent };
  }, [users]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <h2 className="text-2xl font-semibold tracking-tight">Token circulation monitoring</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
          Track how SLT moves through the network, how much is currently held in wallets, and where issuance or spending is concentrating.
        </p>
      </section>

      {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.8rem] border border-white/10 bg-white/5 p-6">
          <Coins className="mb-4 h-6 w-6 text-amber-200" />
          <p className="text-3xl font-semibold">{isLoading ? "..." : `${formatAmount(Number(overview?.total_tokens ?? 0))} SLT`}</p>
          <p className="mt-2 text-sm text-white/55">Total system circulation</p>
        </div>
        <div className="rounded-[1.8rem] border border-white/10 bg-white/5 p-6">
          <ArrowDownRight className="mb-4 h-6 w-6 text-emerald-200" />
          <p className="text-3xl font-semibold">{isLoading ? "..." : `${formatAmount(aggregate.totalEarned)} SLT`}</p>
          <p className="mt-2 text-sm text-white/55">Lifetime tokens issued to users</p>
        </div>
        <div className="rounded-[1.8rem] border border-white/10 bg-white/5 p-6">
          <ArrowUpRight className="mb-4 h-6 w-6 text-blue-200" />
          <p className="text-3xl font-semibold">{isLoading ? "..." : `${formatAmount(aggregate.totalSpent)} SLT`}</p>
          <p className="mt-2 text-sm text-white/55">Lifetime tokens spent by users</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold">Largest wallet balances</h3>
          <div className="mt-5 space-y-4">
            {users.slice(0, 8).map((user) => (
              <div key={user.user_id} className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
                <div>
                  <p className="text-sm font-medium text-white">{user.full_name || "Unnamed user"}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-white/38">{user.role}</p>
                </div>
                <p className="text-sm text-amber-200">{formatAmount(Number(user.balance))} SLT</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold">Recent circulation events</h3>
          <div className="mt-5 space-y-4">
            {transactions.length > 0 ? (
              transactions.map((tx) => (
                <div key={tx.id} className="flex items-start justify-between border-t border-white/8 pt-4 first:border-t-0 first:pt-0">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-white/8">
                      {tx.transaction_type === "send" ? (
                        <ArrowUpRight className="h-5 w-5 text-blue-200" />
                      ) : tx.transaction_type === "receive" ? (
                        <ArrowDownRight className="h-5 w-5 text-emerald-200" />
                      ) : (
                        <Sun className="h-5 w-5 text-amber-200" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{tx.description || "Unnamed transaction"}</p>
                      <p className="mt-1 text-sm text-white/45">{tx.transaction_type}</p>
                    </div>
                  </div>
                  <p className={tx.amount >= 0 ? "text-emerald-300" : "text-amber-200"}>
                    {tx.amount >= 0 ? "+" : ""}
                    {formatAmount(Number(tx.amount))} SLT
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/50">
                {isLoading ? "Loading circulation events..." : "No token events are available."}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <h3 className="text-lg font-semibold">Held supply snapshot</h3>
        <p className="mt-2 text-sm text-white/55">
          Wallet balances currently sum to {formatAmount(aggregate.totalHeld)} SLT. Compare this with system circulation to spot reconciliation gaps.
        </p>
      </section>
    </div>
  );
}
