import { useEffect, useMemo, useState } from "react";
import { getRecentTransactions, type WalletTransactionRow } from "../../lib/supabase-data";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatAmount(value: number) {
  return numberFormatter.format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function TransactionLogs() {
  const [transactions, setTransactions] = useState<WalletTransactionRow[]>([]);
  const [filter, setFilter] = useState<WalletTransactionRow["transaction_type"] | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getRecentTransactions(50)
      .then((data) => {
        if (active) {
          setTransactions(data);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load transaction logs.");
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

  const visibleTransactions = useMemo(() => {
    if (filter === "all") {
      return transactions;
    }

    return transactions.filter((tx) => tx.transaction_type === filter);
  }, [filter, transactions]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <h2 className="text-2xl font-semibold tracking-tight">Transaction logs</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
          Inspect recent system ledger entries with a clean filter for reward issuance, outbound transfers, and inbound receipts.
        </p>
      </section>

      {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="mb-5 flex flex-wrap gap-3">
          {["all", "earn", "send", "receive", "adjustment"].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value as WalletTransactionRow["transaction_type"] | "all")}
              className={`rounded-full px-4 py-2 text-sm transition ${
                filter === value ? "bg-white text-slate-950" : "border border-white/10 bg-black/20 text-white/72"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.18em] text-white/42">
                <th className="px-0 py-3">Transaction ID</th>
                <th className="px-4 py-3">User ID</th>
                <th className="px-4 py-3">Counterparty</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {visibleTransactions.length > 0 ? (
                visibleTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-white/6 text-sm last:border-b-0">
                    <td className="px-0 py-4 text-white/75">{tx.id.slice(0, 8)}</td>
                    <td className="px-4 py-4 text-white/55">{tx.user_id.slice(0, 8)}</td>
                    <td className="px-4 py-4 text-white/55">{tx.counterparty_user_id ? tx.counterparty_user_id.slice(0, 8) : "System"}</td>
                    <td className="px-4 py-4 capitalize text-white">{tx.transaction_type}</td>
                    <td className="px-4 py-4 text-white/75">{tx.description || "No description"}</td>
                    <td className="px-4 py-4 text-white/55">{formatDate(tx.created_at)}</td>
                    <td className={`px-4 py-4 text-right ${tx.amount >= 0 ? "text-emerald-300" : "text-amber-200"}`}>
                      {tx.amount >= 0 ? "+" : ""}
                      {formatAmount(Number(tx.amount))} SLT
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-0 py-12 text-center text-sm text-white/50">
                    {isLoading ? "Loading logs..." : "No transaction records match the current filter."}
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
