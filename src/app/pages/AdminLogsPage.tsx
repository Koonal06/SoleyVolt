import { useEffect, useState } from "react";
import { AlertTriangle, FileText } from "lucide-react";
import { getNotifications, getRecentTransactions, type NotificationRow, type WalletTransactionRow } from "../../lib/supabase-data";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AdminLogsPage() {
  const [transactions, setTransactions] = useState<WalletTransactionRow[]>([]);
  const [alerts, setAlerts] = useState<NotificationRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([getRecentTransactions(20), getNotifications(20)])
      .then(([transactionData, alertData]) => {
        if (active) {
          setTransactions(transactionData);
          setAlerts(alertData);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load admin logs.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <h2 className="text-2xl font-semibold tracking-tight">Logs and alerts</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
          Review operational activity and warning signals together in one monitoring surface.
        </p>
      </section>

      {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <div className="mb-5 flex items-center gap-3">
            <FileText className="h-5 w-5 text-blue-200" />
            <h3 className="text-lg font-semibold">Transaction log stream</h3>
          </div>
          <div className="space-y-4">
            {transactions.map((tx) => (
              <div key={tx.id} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                <p className="text-sm font-medium text-white">{tx.description || "Unnamed event"}</p>
                <p className="mt-1 text-sm capitalize text-white/55">{tx.transaction_type}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.14em] text-white/36">{formatDate(tx.created_at)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <div className="mb-5 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-200" />
            <h3 className="text-lg font-semibold">Alert log stream</h3>
          </div>
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                <p className="text-sm font-medium text-white">{alert.title}</p>
                <p className="mt-2 text-sm leading-6 text-white/62">{alert.message}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.14em] text-white/36">{formatDate(alert.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
