import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Coins, Gauge, Leaf, TriangleAlert, Users, Zap } from "lucide-react";
import {
  type AdminOverviewRow,
  type NotificationRow,
  type UserWalletSummaryRow,
  type WalletTransactionRow,
} from "../../lib/supabase-data";
import { getAdminDashboardSnapshot } from "../../lib/server-api";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatAmount(value: number) {
  return numberFormatter.format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function SystemDashboard() {
  const [overview, setOverview] = useState<AdminOverviewRow | null>(null);
  const [users, setUsers] = useState<UserWalletSummaryRow[]>([]);
  const [transactions, setTransactions] = useState<WalletTransactionRow[]>([]);
  const [alerts, setAlerts] = useState<NotificationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getAdminDashboardSnapshot()
      .then((snapshot) => {
        if (!active) {
          return;
        }

        setOverview(snapshot.overview);
        setUsers((snapshot.users ?? []).slice(0, 6));
        setTransactions((snapshot.transactions ?? []).slice(0, 8));
        setAlerts((snapshot.alerts ?? []).slice(0, 6));
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load admin overview.");
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

  const flaggedCount = useMemo(
    () => alerts.filter((alert) => alert.notification_type === "warning" || alert.notification_type === "error").length,
    [alerts],
  );
  const derivedCoins = useMemo(
    () => ({
      redCoins: Number(overview?.total_red_coins ?? 0),
      yellowCoins: Number(overview?.total_yellow_coins ?? 0),
      greenCoins: Number(overview?.total_green_coins ?? 0),
    }),
    [overview],
  );

  const statCards = [
    { icon: Users, label: "Registered users", value: `${overview?.total_users ?? 0}`, tone: "bg-blue-500/12 text-blue-100" },
    { icon: Zap, label: "Imported energy", value: `${formatAmount(Number(overview?.total_imported_kwh ?? 0))} kWh`, tone: "bg-emerald-500/12 text-emerald-100" },
    { icon: Gauge, label: "Exported energy", value: `${formatAmount(Number(overview?.total_exported_kwh ?? 0))} kWh`, tone: "bg-cyan-500/12 text-cyan-100" },
    { icon: AlertTriangle, label: "Flagged alerts", value: `${flaggedCount}`, tone: "bg-red-500/12 text-red-100" },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <h2 className="text-2xl font-semibold tracking-tight">System dashboard</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
          Review the health of the energy-token network at a glance, from user footprint to circulation and recent compliance signals.
        </p>
      </section>

      {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-[1.8rem] border border-white/10 bg-white/6 p-6">
            <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${card.tone}`}>
              <card.icon className="h-6 w-6" />
            </div>
            <p className="text-3xl font-semibold">{isLoading ? "..." : card.value}</p>
            <p className="mt-2 text-sm text-white/58">{card.label}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: TriangleAlert, label: "Total Red Coins", value: `${formatAmount(derivedCoins.redCoins)} RC` },
          { icon: Leaf, label: "Total Yellow Coins", value: `${formatAmount(derivedCoins.yellowCoins)} YC` },
          { icon: Coins, label: "Total Green Coins", value: `${formatAmount(derivedCoins.greenCoins)} GC` },
        ].map((card) => (
          <div key={card.label} className="rounded-[1.8rem] border border-white/10 bg-white/5 p-6">
            <card.icon className="mb-4 h-6 w-6 text-amber-200" />
            <p className="text-3xl font-semibold">{isLoading ? "..." : card.value}</p>
            <p className="mt-2 text-sm text-white/55">{card.label}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Recent transaction activity</h3>
            <span className="text-xs uppercase tracking-[0.18em] text-white/45">System-wide</span>
          </div>
          <div className="space-y-4">
            {transactions.length > 0 ? (
              transactions.map((tx) => (
                <div key={tx.id} className="flex items-start justify-between border-t border-white/8 pt-4 first:border-t-0 first:pt-0">
                  <div>
                    <p className="text-sm font-medium text-white">{tx.description || "Unnamed transaction"}</p>
                    <p className="mt-1 text-sm text-white/48">
                      {tx.transaction_type} · {formatDate(tx.created_at)}
                    </p>
                  </div>
                  <p className={tx.amount >= 0 ? "text-emerald-300" : "text-amber-200"}>
                    {tx.amount >= 0 ? "+" : ""}
                    {formatAmount(Number(tx.amount))} SLT
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/55">
                {isLoading ? "Loading activity..." : "No transaction records are available."}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Alerts requiring review</h3>
            <AlertTriangle className="h-5 w-5 text-amber-200" />
          </div>
          <div className="space-y-4">
            {alerts.length > 0 ? (
              alerts.map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <p className="text-sm font-medium text-white">{alert.title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/62">{alert.message}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-white/38">{formatDate(alert.created_at)}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/55">
                {isLoading ? "Loading alerts..." : "No alerts were returned for this admin account."}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Users with the highest balances</h3>
          <span className="text-xs uppercase tracking-[0.18em] text-white/45">Top wallets</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.18em] text-white/42">
                <th className="px-0 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Imported</th>
                <th className="px-4 py-3">Exported</th>
              </tr>
            </thead>
            <tbody>
              {users.length > 0 ? (
                users.map((entry) => (
                  <tr key={entry.user_id} className="border-b border-white/6 text-sm last:border-b-0">
                    <td className="px-0 py-4 text-white">{entry.full_name || "Unnamed user"}</td>
                    <td className="px-4 py-4 capitalize text-white/62">{entry.role}</td>
                    <td className="px-4 py-4 capitalize text-white/62">{entry.status}</td>
                    <td className="px-4 py-4 text-white">{formatAmount(Number(entry.balance))} SLT</td>
                    <td className="px-4 py-4 text-white/62">{formatAmount(Number(entry.total_imported_kwh))} kWh</td>
                    <td className="px-4 py-4 text-white/62">{formatAmount(Number(entry.total_exported_kwh))} kWh</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-0 py-10 text-center text-sm text-white/50">
                    {isLoading ? "Loading user exposure..." : "No user summary data is available."}
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
