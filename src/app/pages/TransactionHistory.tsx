import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Sun } from "lucide-react";
import { getMyTransactions, type WalletTransactionRow } from "../../lib/supabase-data";

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

export function TransactionHistory() {
  const [transactions, setTransactions] = useState<WalletTransactionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getMyTransactions(50)
      .then((data) => {
        if (active) {
          setTransactions(data);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load transaction history.");
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

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Transaction history</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Review every wallet movement tied to your account, including solar rewards, incoming transfers, and tokens you sent.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : null}

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-4 text-left text-xs uppercase tracking-[0.18em] text-slate-500">Type</th>
                <th className="px-5 py-4 text-left text-xs uppercase tracking-[0.18em] text-slate-500">Description</th>
                <th className="px-5 py-4 text-left text-xs uppercase tracking-[0.18em] text-slate-500">Counterparty</th>
                <th className="px-5 py-4 text-left text-xs uppercase tracking-[0.18em] text-slate-500">Timestamp</th>
                <th className="px-5 py-4 text-right text-xs uppercase tracking-[0.18em] text-slate-500">Amount</th>
                <th className="px-5 py-4 text-right text-xs uppercase tracking-[0.18em] text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length > 0 ? (
                transactions.map((tx) => (
                  <tr key={tx.id} className="border-t border-slate-100">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full ${
                            tx.transaction_type === "receive"
                              ? "bg-emerald-100 text-emerald-700"
                              : tx.transaction_type === "send"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {tx.transaction_type === "receive" ? (
                            <ArrowDownRight className="h-5 w-5" />
                          ) : tx.transaction_type === "send" ? (
                            <ArrowUpRight className="h-5 w-5" />
                          ) : (
                            <Sun className="h-5 w-5" />
                          )}
                        </div>
                        <span className="capitalize text-slate-800">{tx.transaction_type}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-800">{tx.description || "No description"}</td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {tx.counterparty_user_id ? tx.counterparty_user_id.slice(0, 8) : "System"}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">{formatDate(tx.created_at)}</td>
                    <td className={`px-5 py-4 text-right font-medium ${tx.amount >= 0 ? "text-emerald-700" : "text-blue-800"}`}>
                      {tx.amount >= 0 ? "+" : ""}
                      {formatAmount(Number(tx.amount))} SLT
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-600">
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                    {isLoading ? "Loading transaction history..." : "No transaction history is available yet."}
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
