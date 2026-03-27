import { useEffect, useMemo, useState } from "react";
import { Coins, CreditCard, ReceiptText } from "lucide-react";
import { getAdminPurchases, type GreenCoinPurchaseRow } from "../../lib/supabase-data";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatAmount(value: number) {
  return numberFormatter.format(value);
}

export function PurchasesPage() {
  const [purchases, setPurchases] = useState<GreenCoinPurchaseRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getAdminPurchases(40)
      .then((data) => {
        if (active) {
          setPurchases(data);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load purchase activity.");
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

  const purchaseRows = useMemo(() => purchases, [purchases]);

  const totalVolume = purchaseRows.reduce((sum, tx) => sum + Number(tx.green_coins), 0);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <h2 className="text-2xl font-semibold tracking-tight">Purchases</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
          Monitor purchase-style activity such as Green Coin acquisition, credited adjustments, and related incoming value flows.
        </p>
      </section>

      {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: CreditCard, label: "Purchase records", value: `${purchaseRows.length}` },
          { icon: Coins, label: "Total credited volume", value: `${formatAmount(totalVolume)} coins` },
          { icon: ReceiptText, label: "Review window", value: "Last 40 records" },
        ].map((card) => (
          <div key={card.label} className="rounded-[1.8rem] border border-white/10 bg-white/5 p-6">
            <card.icon className="mb-4 h-6 w-6 text-emerald-200" />
            <p className="text-3xl font-semibold">{isLoading ? "..." : card.value}</p>
            <p className="mt-2 text-sm text-white/55">{card.label}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.18em] text-white/42">
                <th className="px-0 py-3">Type</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {purchaseRows.length > 0 ? (
                purchaseRows.map((tx) => (
                  <tr key={tx.id} className="border-b border-white/6 text-sm last:border-b-0">
                    <td className="px-0 py-4 capitalize text-white">{tx.transaction_type}</td>
                    <td className="px-4 py-4 text-white/72">{tx.payment_reference || "Green Coin purchase"}</td>
                    <td className="px-4 py-4 text-white/48">{tx.user_id.slice(0, 8)}</td>
                    <td className="px-4 py-4 text-emerald-300">{formatAmount(Number(tx.green_coins))} GC</td>
                    <td className="px-4 py-4 capitalize text-white/55">{tx.status}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-0 py-12 text-center text-sm text-white/50">
                    {isLoading ? "Loading purchases..." : "No purchase-style activity is available."}
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
