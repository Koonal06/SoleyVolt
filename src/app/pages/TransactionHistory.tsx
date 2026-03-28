import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, RefreshCcw } from "lucide-react";
import { getUserTransactionHistory, type EnrichedTransactionHistoryItem } from "../../lib/server-api";
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
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function TransactionHistory() {
  const { profile, user } = useAuth();
  const language = useAppLanguage(profile?.language);
  const copy = getUserPortalCopy(language);
  const locale = getLanguageLocale(language);
  const [transactions, setTransactions] = useState<EnrichedTransactionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let refreshTimeout = 0;

    async function loadHistory(showSpinner: boolean) {
      if (showSpinner) {
        setIsLoading(true);
      }

      try {
        const data = await getUserTransactionHistory({ limit: 50 });

        if (!active) {
          return;
        }

        if (!data.success) {
          if (showSpinner) {
            setError(data.error ?? copy.history.loadError);
            setTransactions([]);
          }

          return;
        }

        setTransactions(data.transactions);
        setError(null);
      } catch (err) {
        if (active && showSpinner) {
          setError(err instanceof Error ? err.message : copy.history.loadError);
        }
      } finally {
        if (active && showSpinner) {
          setIsLoading(false);
        }
      }
    }

    if (!user?.id) {
      setTransactions([]);
      setIsLoading(false);

      return () => {
        active = false;
      };
    }

    void loadHistory(true);

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

        void loadHistory(false);
      }, 150);
    };

    const channel = supabase
      .channel(`transaction-history-live-${user.id}-${Math.random().toString(36).slice(2)}`)
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
  }, [copy.history.loadError, user?.id]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{copy.history.title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          {copy.history.description}
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
                <th className="px-5 py-4 text-left text-xs uppercase tracking-[0.18em] text-slate-500">{copy.history.type}</th>
                <th className="px-5 py-4 text-left text-xs uppercase tracking-[0.18em] text-slate-500">{copy.history.detail}</th>
                <th className="px-5 py-4 text-left text-xs uppercase tracking-[0.18em] text-slate-500">{copy.history.counterparty}</th>
                <th className="px-5 py-4 text-left text-xs uppercase tracking-[0.18em] text-slate-500">{copy.history.timestamp}</th>
                <th className="px-5 py-4 text-right text-xs uppercase tracking-[0.18em] text-slate-500">{copy.history.amount}</th>
                <th className="px-5 py-4 text-right text-xs uppercase tracking-[0.18em] text-slate-500">{copy.history.status}</th>
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
                            tx.direction === "received"
                              ? "bg-emerald-100 text-emerald-700"
                              : tx.direction === "sent"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {tx.direction === "received" ? (
                            <ArrowDownRight className="h-5 w-5" />
                          ) : tx.direction === "sent" ? (
                            <ArrowUpRight className="h-5 w-5" />
                          ) : (
                            <RefreshCcw className="h-5 w-5" />
                          )}
                        </div>
                        <span className="capitalize text-slate-800">{tx.direction}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-800">
                      <div>{tx.description || copy.history.noDescription}</div>
                      {tx.note ? <div className="mt-1 text-xs text-slate-500">{tx.note}</div> : null}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {tx.direction === "system"
                        ? copy.history.system
                        : (tx.direction === "sent" ? tx.receiver_id : tx.sender_id)?.slice(0, 8) ?? copy.history.system}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">{formatDate(tx.created_at, locale)}</td>
                    <td className={`px-5 py-4 text-right font-medium ${tx.amount >= 0 ? "text-emerald-700" : "text-blue-800"}`}>
                      {tx.amount >= 0 ? "+" : ""}
                      {formatAmount(Number(tx.amount))} {tx.token_type === "green_purchase" || tx.token_type === "monthly_settlement" ? "GC" : "SLT"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-600">
                        {getStatusLabel(language, tx.status)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                    {isLoading ? copy.history.loading : copy.history.empty}
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
