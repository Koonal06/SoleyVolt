import { useEffect, useState } from "react";
import { BadgeDollarSign, Leaf, ReceiptText, TriangleAlert } from "lucide-react";
import {
  getMyPortalSummary,
  type UserPortalSummaryRow,
} from "../../lib/supabase-data";
import { useAppLanguage } from "../lib/language";
import { getUserPortalCopy } from "../lib/user-portal-copy";
import { useAuth } from "../providers/AuthProvider";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatAmount(value: number) {
  return numberFormatter.format(value);
}

export function BillPage() {
  const { profile, userType } = useAuth();
  const language = useAppLanguage(profile?.language);
  const copy = getUserPortalCopy(language);
  const [summary, setSummary] = useState<UserPortalSummaryRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getMyPortalSummary()
      .then((summaryData) => {
        if (active) {
          setSummary(summaryData);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : copy.bill.loadError);
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
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
          {userType === "producer" ? copy.bill.titleProducer : copy.bill.titleDefault}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          {userType === "producer"
            ? copy.bill.descProducer
            : copy.bill.descDefault}
        </p>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: ReceiptText, label: copy.bill.importedEnergy, value: `${formatAmount(Number(summary?.total_imported_kwh ?? 0))} kWh`, tone: "text-blue-700 bg-blue-100" },
          { icon: TriangleAlert, label: copy.bill.redCoins, value: `${formatAmount(Number(summary?.red_coins ?? 0))} RC`, tone: "text-rose-700 bg-rose-100" },
          { icon: Leaf, label: copy.bill.greenCoins, value: `${formatAmount(Number(summary?.green_coins ?? 0))} GC`, tone: "text-emerald-700 bg-emerald-100" },
          { icon: BadgeDollarSign, label: userType === "producer" ? copy.bill.settlementEstimate : copy.bill.billEstimate, value: `${formatAmount(Number(summary?.bill_estimate ?? 0))} RC`, tone: "text-amber-700 bg-amber-100" },
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

      <section>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-950">{copy.bill.currentPosition}</h3>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p>{copy.bill.importedEnergy}: {formatAmount(Number(summary?.total_imported_kwh ?? 0))} kWh</p>
            <p>{copy.bill.exportedEnergy}: {formatAmount(Number(summary?.total_exported_kwh ?? 0))} kWh</p>
            <p>{copy.bill.yellowCoinSupport}: {formatAmount(Number(summary?.yellow_coins ?? 0))} YC</p>
            <p>{copy.bill.estimatedNetObligation}: {formatAmount(Number(summary?.bill_estimate ?? 0))} RC</p>
          </div>
        </div>
      </section>
    </div>
  );
}
