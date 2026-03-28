import { useEffect, useMemo, useState } from "react";
import { BadgeDollarSign } from "lucide-react";
import { getAdminUsers, type UserWalletSummaryRow } from "../../lib/supabase-data";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatAmount(value: number) {
  return numberFormatter.format(value);
}

export function AdminBillsPage() {
  const [rows, setRows] = useState<UserWalletSummaryRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getAdminUsers(100)
      .then((data) => {
        if (active) {
          setRows(data.filter((entry) => entry.role === "user"));
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load billing data.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.billEstimate += Number(row.bill_estimate ?? 0);
          acc.imported += Number(row.total_imported_kwh ?? 0);
          acc.exported += Number(row.total_exported_kwh ?? 0);
          return acc;
        },
        { billEstimate: 0, imported: 0, exported: 0 },
      ),
    [rows],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="flex items-center gap-3">
          <BadgeDollarSign className="h-5 w-5 text-amber-200" />
          <h2 className="text-2xl font-semibold tracking-tight">Bill monitoring</h2>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
          Inspect estimated bills, imported consumption, and exported offsets across active user accounts.
        </p>
      </section>

      {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Estimated bills", value: `${formatAmount(totals.billEstimate)} RC` },
          { label: "Imported energy", value: `${formatAmount(totals.imported)} kWh` },
          { label: "Exported energy", value: `${formatAmount(totals.exported)} kWh` },
        ].map((item) => (
          <div key={item.label} className="rounded-[1.8rem] border border-white/10 bg-white/5 p-6">
            <p className="text-3xl font-semibold text-white">{item.value}</p>
            <p className="mt-2 text-sm text-white/55">{item.label}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.18em] text-white/42">
                <th className="px-0 py-3">User</th>
                <th className="px-4 py-3">User Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Imported</th>
                <th className="px-4 py-3">Exported</th>
                <th className="px-4 py-3">Bill Estimate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr key={entry.user_id} className="border-b border-white/6 text-sm last:border-b-0">
                  <td className="px-0 py-4 text-white">{entry.full_name || "Unnamed user"}</td>
                  <td className="px-4 py-4 capitalize text-white/62">{entry.user_type}</td>
                  <td className="px-4 py-4 capitalize text-white/62">{entry.status}</td>
                  <td className="px-4 py-4 text-white/62">{formatAmount(Number(entry.total_imported_kwh))} kWh</td>
                  <td className="px-4 py-4 text-white/62">{formatAmount(Number(entry.total_exported_kwh))} kWh</td>
                  <td className="px-4 py-4 text-white">{formatAmount(Number(entry.bill_estimate))} RC</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
