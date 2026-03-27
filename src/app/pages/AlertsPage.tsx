import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Siren } from "lucide-react";
import { getNotifications, type NotificationRow } from "../../lib/supabase-data";

function iconFor(type: NotificationRow["notification_type"]) {
  if (type === "warning") {
    return <AlertTriangle className="h-5 w-5 text-amber-200" />;
  }

  if (type === "success") {
    return <CheckCircle2 className="h-5 w-5 text-emerald-200" />;
  }

  return <Info className="h-5 w-5 text-blue-200" />;
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

export function AlertsPage() {
  const [alerts, setAlerts] = useState<NotificationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getNotifications(30)
      .then((data) => {
        if (active) {
          setAlerts(data);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load alerts.");
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

  const flaggedAlerts = useMemo(
    () => alerts.filter((alert) => alert.notification_type === "warning" || alert.notification_type === "error"),
    [alerts],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Alerts and flagged activities</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
              Surface notifications that may need operator attention, especially unusual events, warnings, or unresolved activity.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-[0.16em] text-amber-100/80">Flagged now</p>
            <p className="mt-1 text-2xl font-semibold text-amber-100">{flaggedAlerts.length}</p>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <div className="mb-4 flex items-center gap-3">
            <Siren className="h-5 w-5 text-amber-200" />
            <h3 className="text-lg font-semibold">Priority queue</h3>
          </div>
          <div className="space-y-4">
            {flaggedAlerts.length > 0 ? (
              flaggedAlerts.map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-amber-300/15 bg-amber-500/6 p-4">
                  <p className="text-sm font-medium text-white">{alert.title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/62">{alert.message}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/50">
                {isLoading ? "Loading flagged alerts..." : "No flagged alerts are currently in the queue."}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold">All alert records</h3>
          <div className="mt-5 space-y-4">
            {alerts.length > 0 ? (
              alerts.map((alert) => (
                <div key={alert.id} className="flex items-start gap-4 rounded-2xl border border-white/8 bg-black/15 p-4">
                  <div className="mt-0.5">{iconFor(alert.notification_type)}</div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-sm font-medium text-white">{alert.title}</p>
                      <span className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-white/55">
                        {alert.notification_type}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/62">{alert.message}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-white/38">{formatDate(alert.created_at)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/50">
                {isLoading ? "Loading alerts..." : "No alert records were returned."}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
