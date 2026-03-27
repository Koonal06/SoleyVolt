import { useEffect, useState } from "react";
import {
  Wallet as WalletIcon,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Sun,
} from "lucide-react";
import {
  getMyTransactions,
  getMyWallet,
  type WalletRow,
  type WalletTransactionRow,
} from "../../lib/supabase-data";
import { useAuth } from "../providers/AuthProvider";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatAmount(value: number) {
  return numberFormatter.format(value);
}

function formatDate(value: string) {
  const date = new Date(value);

  return {
    date: new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(date),
    time: new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date),
  };
}

export function Wallet() {
  const { userType } = useAuth();
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadWallet() {
      try {
        setIsLoading(true);
        setError(null);

        const [walletData, transactionData] = await Promise.all([getMyWallet(), getMyTransactions(20)]);

        if (!active) {
          return;
        }

        setWallet(walletData);
        setTransactions(transactionData);
      } catch (err) {
        if (!active) {
          return;
        }

        setError(err instanceof Error ? err.message : "Unable to load wallet data.");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadWallet();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="rounded-2xl bg-gradient-to-br from-amber-500 via-amber-400 to-emerald-500 p-8 text-white shadow-xl">
        <div className="mb-6 flex items-center gap-2">
          <WalletIcon className="h-8 w-8" />
          <span className="text-xl">
            {userType === "producer" ? "Stored Credits" : userType === "consumer" ? "Bill Offset Wallet" : "Hybrid Energy Wallet"}
          </span>
        </div>
        <div className="mb-8">
          <h1 className="mb-2">{isLoading ? "Loading..." : `${formatAmount(Number(wallet?.balance ?? 0))} SLT`}</h1>
          <p className="text-amber-100">
            {userType === "producer" ? "Stored production credits" : userType === "consumer" ? "Available bill-offset balance" : "Combined settlement balance"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-xl bg-white/20 p-4 backdrop-blur-sm">
            <div className="mb-2 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              <span className="text-sm">Earned</span>
            </div>
            <p className="text-xl">{formatAmount(Number(wallet?.lifetime_earned ?? 0))} SLT</p>
          </div>
          <div className="rounded-xl bg-white/20 p-4 backdrop-blur-sm">
            <div className="mb-2 flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              <span className="text-sm">Spent</span>
            </div>
            <p className="text-xl">{formatAmount(Number(wallet?.lifetime_spent ?? 0))} SLT</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-blue-900">Transaction History</h3>
          <div className="flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-1.5 text-sm text-emerald-700">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Live backend data
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-sm text-gray-600">Type</th>
                <th className="px-4 py-3 text-left text-sm text-gray-600">Description</th>
                <th className="px-4 py-3 text-left text-sm text-gray-600">Date</th>
                <th className="px-4 py-3 text-left text-sm text-gray-600">Time</th>
                <th className="px-4 py-3 text-right text-sm text-gray-600">Amount</th>
                <th className="px-4 py-3 text-right text-sm text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length > 0 ? (
                transactions.map((tx) => {
                  const formatted = formatDate(tx.created_at);

                  return (
                    <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full ${
                            tx.transaction_type === "earn"
                              ? "bg-amber-100"
                              : tx.transaction_type === "receive"
                                ? "bg-emerald-100"
                                : "bg-blue-100"
                          }`}
                        >
                          {tx.transaction_type === "earn" ? (
                            <Sun className="h-4 w-4 text-amber-600" />
                          ) : tx.transaction_type === "receive" ? (
                            <ArrowDownRight className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-blue-900">{tx.description}</td>
                      <td className="px-4 py-3 text-gray-600">{formatted.date}</td>
                      <td className="px-4 py-3 text-gray-600">{formatted.time}</td>
                      <td className={`px-4 py-3 text-right ${tx.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {tx.amount >= 0 ? "+" : ""}
                        {formatAmount(Number(tx.amount))} SLT
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm capitalize text-emerald-700">
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-600">
                    {isLoading ? "Loading transactions..." : "No wallet activity yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
