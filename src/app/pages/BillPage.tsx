import { useEffect, useState } from "react";
import { BadgeDollarSign, Leaf, ReceiptText, TriangleAlert } from "lucide-react";
import {
  getCoinSettings,
  getMyGreenCoinPurchases,
  getMyPortalSummary,
  purchaseGreenCoins,
  type CoinSettingsRow,
  type GreenCoinPurchaseRow,
  type UserPortalSummaryRow,
} from "../../lib/supabase-data";
import { useAuth } from "../providers/AuthProvider";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatAmount(value: number) {
  return numberFormatter.format(value);
}

export function BillPage() {
  const { userType } = useAuth();
  const [summary, setSummary] = useState<UserPortalSummaryRow | null>(null);
  const [coinSettings, setCoinSettings] = useState<CoinSettingsRow | null>(null);
  const [purchases, setPurchases] = useState<GreenCoinPurchaseRow[]>([]);
  const [purchaseAmount, setPurchaseAmount] = useState("25");
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([getMyPortalSummary(), getCoinSettings(), getMyGreenCoinPurchases(10)])
      .then(([summaryData, settingsData, purchaseData]) => {
        if (active) {
          setSummary(summaryData);
          setCoinSettings(settingsData);
          setPurchases(purchaseData);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load bill data.");
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

  const handlePurchase = async () => {
    const parsedAmount = Number(purchaseAmount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid Green Coin amount.");
      return;
    }

    try {
      setIsPurchasing(true);
      setError(null);
      setSuccess(null);

      await purchaseGreenCoins(parsedAmount);
      const [nextSummary, nextPurchases] = await Promise.all([getMyPortalSummary(), getMyGreenCoinPurchases(10)]);

      setSummary(nextSummary);
      setPurchases(nextPurchases);
      setSuccess(`Purchased ${formatAmount(parsedAmount)} Green Coins.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to purchase Green Coins.");
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
          {userType === "producer" ? "Settlement and credit position" : "Bill and offset summary"}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          {userType === "producer"
            ? "Review production-led credits, expected settlement value, and how your stored earnings are accumulating."
            : "Track current bill obligation, Red Coin exposure, and how Green or Yellow Coin activity helps reduce payable energy costs."}
        </p>
      </section>

      {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: ReceiptText, label: "Imported energy", value: `${formatAmount(Number(summary?.total_imported_kwh ?? 0))} kWh`, tone: "text-blue-700 bg-blue-100" },
          { icon: TriangleAlert, label: "Red Coins", value: `${formatAmount(Number(summary?.red_coins ?? 0))} RC`, tone: "text-rose-700 bg-rose-100" },
          { icon: Leaf, label: "Green Coins", value: `${formatAmount(Number(summary?.green_coins ?? 0))} GC`, tone: "text-emerald-700 bg-emerald-100" },
          { icon: BadgeDollarSign, label: userType === "producer" ? "Settlement estimate" : "Bill estimate", value: `${formatAmount(Number(summary?.bill_estimate ?? 0))} RC`, tone: "text-amber-700 bg-amber-100" },
        ].map((card) => (
          <div key={card.label} className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${card.tone}`}>
              <card.icon className="h-6 w-6" />
            </div>
            <p className="text-3xl font-semibold text-slate-950">{isLoading ? "..." : card.value}</p>
            <p className="mt-2 text-sm text-slate-600">{card.label}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-950">Buy Green Coins</h3>
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              Current unit price: {formatAmount(Number(coinSettings?.green_coin_unit_price ?? 0))} per Green Coin
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Purchase amount</label>
              <input
                type="number"
                min="1"
                step="1"
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </div>
            <button
              type="button"
              onClick={handlePurchase}
              disabled={isPurchasing}
              className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPurchasing ? "Processing..." : "Buy Green Coins"}
            </button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-950">Current position</h3>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p>Imported energy: {formatAmount(Number(summary?.total_imported_kwh ?? 0))} kWh</p>
            <p>Exported energy: {formatAmount(Number(summary?.total_exported_kwh ?? 0))} kWh</p>
            <p>Yellow Coin support: {formatAmount(Number(summary?.yellow_coins ?? 0))} YC</p>
            <p>Estimated net obligation: {formatAmount(Number(summary?.bill_estimate ?? 0))} RC</p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-950">Recent Green Coin purchases</h3>
        <div className="mt-4 space-y-3">
          {purchases.length > 0 ? (
            purchases.map((purchase) => (
              <div key={purchase.id} className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">{formatAmount(Number(purchase.green_coins))} GC purchased</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{purchase.status}</p>
                </div>
                <p className="text-sm text-slate-600">{formatAmount(Number(purchase.total_cost))}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">{isLoading ? "Loading purchases..." : "No Green Coin purchases yet."}</p>
          )}
        </div>
      </section>
    </div>
  );
}
