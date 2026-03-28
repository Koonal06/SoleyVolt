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
  getMyPortalSummary,
  getMyTransactions,
  getMyWallet,
  type UserPortalSummaryRow,
  type WalletRow,
  type WalletTransactionRow,
} from "../../lib/supabase-data";
import { supabase } from "../../lib/supabase";
import { useAppLanguage } from "../lib/language";
import { getLanguageLocale, getStatusLabel, getUserPortalCopy } from "../lib/user-portal-copy";
import { useAuth } from "../providers/AuthProvider";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatAmount(value: number) {
  return numberFormatter.format(value);
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);

  return {
    date: new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(date),
    time: new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date),
  };
}

export function Wallet() {
  const { profile, user, userType } = useAuth();
  const language = useAppLanguage(profile?.language);
  const copy = getUserPortalCopy(language);
  const locale = getLanguageLocale(language);
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [summary, setSummary] = useState<UserPortalSummaryRow | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let refreshTimeout = 0;

    async function loadWallet(showSpinner: boolean) {
      try {
        if (showSpinner) {
          setIsLoading(true);
          setError(null);
        }

        const [walletData, summaryData, transactionData] = await Promise.all([
          getMyWallet(),
          getMyPortalSummary(),
          getMyTransactions(20),
        ]);

        if (!active) {
          return;
        }

        setWallet(walletData);
        setSummary(summaryData);
        setTransactions(transactionData);
        setError(null);
      } catch (err) {
        if (!active) {
          return;
        }

        if (showSpinner) {
          setError(err instanceof Error ? err.message : copy.wallet.loadError);
        }
      } finally {
        if (active && showSpinner) {
          setIsLoading(false);
        }
      }
    }

    if (!user?.id) {
      setWallet(null);
      setSummary(null);
      setTransactions([]);
      setIsLoading(false);

      return () => {
        active = false;
      };
    }

    void loadWallet(true);

    if (!supabase) {
      return () => {
        active = false;
      };
    }

    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimeout);
      refreshTimeout = window.setTimeout(() => {
        if (!active) {
          return;
        }

        void loadWallet(false);
      }, 150);
    };

    const channel = supabase
      .channel(`wallet-live-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallets",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (!active) {
            return;
          }

          if (payload.eventType === "DELETE") {
            setWallet(null);
          } else {
            setWallet(payload.new as WalletRow);
          }

          scheduleRefresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallet_transactions",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (!active) {
            return;
          }

          scheduleRefresh();
        },
      )
      .subscribe();

    return () => {
      active = false;
      window.clearTimeout(refreshTimeout);
      void channel.unsubscribe();
    };
  }, [copy.wallet.loadError, user?.id]);

  const yellowDisplay = Math.max(
    Number(wallet?.yellow_token ?? 0),
    Number(summary?.yellow_coins ?? 0),
  );
  const redDisplay = Math.max(
    Number(wallet?.red_token ?? 0),
    Number(summary?.red_coins ?? 0),
  );
  const greenDisplay = Math.max(
    Number(wallet?.green_token ?? 0),
    Number(summary?.green_coins ?? 0),
  );
  const balanceDisplay = Number(
    wallet?.balance ?? summary?.balance ?? Math.max(yellowDisplay + greenDisplay - redDisplay, 0),
  );

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
            {userType === "producer" ? copy.wallet.storedCredits : userType === "consumer" ? copy.wallet.billOffsetWallet : copy.wallet.hybridWallet}
          </span>
        </div>
        <div className="mb-8">
          <h1 className="mb-2">{isLoading ? copy.wallet.loading : `${formatAmount(balanceDisplay)} SLT`}</h1>
          <p className="text-amber-100">
            {userType === "producer" ? copy.wallet.storedProductionCredits : userType === "consumer" ? copy.wallet.availableBillOffset : copy.wallet.combinedSettlementBalance}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-xl bg-white/20 p-4 backdrop-blur-sm">
            <div className="mb-2 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              <span className="text-sm">{copy.wallet.earned}</span>
            </div>
            <p className="text-xl">{formatAmount(Number(wallet?.lifetime_earned ?? 0))} SLT</p>
          </div>
          <div className="rounded-xl bg-white/20 p-4 backdrop-blur-sm">
            <div className="mb-2 flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              <span className="text-sm">{copy.wallet.spent}</span>
            </div>
            <p className="text-xl">{formatAmount(Number(wallet?.lifetime_spent ?? 0))} SLT</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white/16 p-4 backdrop-blur-sm">
            <p className="text-sm text-amber-50/85">Yellow Tokens</p>
            <p className="mt-2 text-2xl font-semibold">{formatAmount(yellowDisplay)} YC</p>
            <p className="mt-1 text-sm text-amber-50/75">Earned from surplus export after pipeline promotion.</p>
          </div>
          <div className="rounded-xl bg-white/16 p-4 backdrop-blur-sm">
            <p className="text-sm text-amber-50/85">Red Tokens</p>
            <p className="mt-2 text-2xl font-semibold">{formatAmount(redDisplay)} RC</p>
            <p className="mt-1 text-sm text-amber-50/75">Consumption obligation tracked separately from earned credits.</p>
          </div>
          <div className="rounded-xl bg-white/16 p-4 backdrop-blur-sm">
            <p className="text-sm text-amber-50/85">Green Tokens</p>
            <p className="mt-2 text-2xl font-semibold">{formatAmount(greenDisplay)} GC</p>
            <p className="mt-1 text-sm text-amber-50/75">Purchased bill-offset credits available for settlement.</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-blue-900">{copy.wallet.transactionHistory}</h3>
          <div className="flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-1.5 text-sm text-emerald-700">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            {copy.wallet.liveBackendData}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-sm text-gray-600">{copy.wallet.type}</th>
                <th className="px-4 py-3 text-left text-sm text-gray-600">{copy.wallet.description}</th>
                <th className="px-4 py-3 text-left text-sm text-gray-600">{copy.wallet.date}</th>
                <th className="px-4 py-3 text-left text-sm text-gray-600">{copy.wallet.time}</th>
                <th className="px-4 py-3 text-right text-sm text-gray-600">{copy.wallet.amount}</th>
                <th className="px-4 py-3 text-right text-sm text-gray-600">{copy.wallet.status}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length > 0 ? (
                transactions.map((tx) => {
                  const formatted = formatDate(tx.created_at, locale);

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
                          {getStatusLabel(language, tx.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-600">
                    {isLoading ? copy.wallet.loadingTransactions : copy.wallet.noWalletActivity}
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
