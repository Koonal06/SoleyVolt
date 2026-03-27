import { useEffect, useMemo, useState } from "react";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { getAdminOverview, getAdminUsers, type AdminOverviewRow, type UserWalletSummaryRow } from "../../lib/supabase-data";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatAmount(value: number) {
  return numberFormatter.format(value);
}

export function EnergyMonitoring() {
  const [overview, setOverview] = useState<AdminOverviewRow | null>(null);
  const [users, setUsers] = useState<UserWalletSummaryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([getAdminOverview(), getAdminUsers(30)])
      .then(([overviewData, userData]) => {
        if (active) {
          setOverview(overviewData);
          setUsers(userData);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load energy monitoring data.");
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

  const topExporters = useMemo(
    () => [...users].sort((a, b) => Number(b.total_exported_kwh) - Number(a.total_exported_kwh)).slice(0, 8),
    [users],
  );

  const topImporters = useMemo(
    () => [...users].sort((a, b) => Number(b.total_imported_kwh) - Number(a.total_imported_kwh)).slice(0, 8),
    [users],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <h2 className="text-2xl font-semibold tracking-tight">Energy import/export monitoring</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
          Compare energy entering and leaving the network to identify concentration, trading patterns, and production hotspots.
        </p>
      </section>

      {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.8rem] border border-white/10 bg-white/5 p-6">
          <TrendingDown className="mb-4 h-6 w-6 text-blue-200" />
          <p className="text-3xl font-semibold">{isLoading ? "..." : `${formatAmount(Number(overview?.total_imported_kwh ?? 0))} kWh`}</p>
          <p className="mt-2 text-sm text-white/55">Total imported energy</p>
        </div>
        <div className="rounded-[1.8rem] border border-white/10 bg-white/5 p-6">
          <TrendingUp className="mb-4 h-6 w-6 text-emerald-200" />
          <p className="text-3xl font-semibold">{isLoading ? "..." : `${formatAmount(Number(overview?.total_exported_kwh ?? 0))} kWh`}</p>
          <p className="mt-2 text-sm text-white/55">Total exported energy</p>
        </div>
        <div className="rounded-[1.8rem] border border-white/10 bg-white/5 p-6">
          <BarChart3 className="mb-4 h-6 w-6 text-amber-200" />
          <p className="text-3xl font-semibold">
            {isLoading ? "..." : `${formatAmount(Number(overview?.total_exported_kwh ?? 0) - Number(overview?.total_imported_kwh ?? 0))} kWh`}
          </p>
          <p className="mt-2 text-sm text-white/55">Net exported balance</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold">Top exporting accounts</h3>
          <div className="mt-5 space-y-4">
            {topExporters.map((user) => (
              <div key={user.user_id} className="flex items-center justify-between border-t border-white/8 pt-4 first:border-t-0 first:pt-0">
                <div>
                  <p className="text-sm font-medium text-white">{user.full_name || "Unnamed user"}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-white/38">{user.status}</p>
                </div>
                <p className="text-sm text-emerald-300">{formatAmount(Number(user.total_exported_kwh))} kWh</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold">Top importing accounts</h3>
          <div className="mt-5 space-y-4">
            {topImporters.map((user) => (
              <div key={user.user_id} className="flex items-center justify-between border-t border-white/8 pt-4 first:border-t-0 first:pt-0">
                <div>
                  <p className="text-sm font-medium text-white">{user.full_name || "Unnamed user"}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-white/38">{user.status}</p>
                </div>
                <p className="text-sm text-blue-200">{formatAmount(Number(user.total_imported_kwh))} kWh</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
