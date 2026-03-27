import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, Bot, CheckCircle2, Link2, RefreshCcw } from "lucide-react";
import {
  type AdminProfileOptionRow,
  type DatasetUserMappingRow,
  type EnergyImportAdminRow,
} from "../../lib/supabase-data";
import { getEnergyPipelineSnapshot, saveDatasetUserMapping, type EnergyPipelineRun } from "../../lib/server-api";

function formatAmount(value: number | null | undefined, digits = 2) {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat("en", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(numeric);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

type MappingSelection = Record<string, string>;

export function EnergyPipelineAdminPage() {
  const [imports, setImports] = useState<EnergyImportAdminRow[]>([]);
  const [mappings, setMappings] = useState<DatasetUserMappingRow[]>([]);
  const [profiles, setProfiles] = useState<AdminProfileOptionRow[]>([]);
  const [latestRun, setLatestRun] = useState<EnergyPipelineRun | null>(null);
  const [selection, setSelection] = useState<MappingSelection>({});
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;

    getEnergyPipelineSnapshot()
      .then(({ imports: importRows, mappings: mappingRows, profiles: profileRows, latestRun: latestRunData }) => {
        if (!active) {
          return;
        }

        setImports(importRows);
        setMappings(mappingRows);
        setProfiles(profileRows);
        setLatestRun(latestRunData);
        setError(null);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load energy pipeline admin data.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const groupedDatasetUsers = useMemo(() => {
    const map = new Map<string, EnergyImportAdminRow[]>();
    for (const row of imports) {
      const current = map.get(row.dataset_user_code) ?? [];
      current.push(row);
      map.set(row.dataset_user_code, current);
    }
    return [...map.entries()].map(([datasetUserCode, rows]) => {
      const first = rows[0];
      const mappedRows = rows.filter((row) => row.linked_user_id);
      const statuses = new Set(rows.map((row) => row.processing_status));
      return {
        datasetUserCode,
        datasetUserType: first.dataset_user_type,
        sourceFileName: first.source_file_name,
        meterId: first.meter_id,
        rowCount: rows.length,
        mappedCount: mappedRows.length,
        linkedUserId: first.linked_user_id,
        linkedUserLabel: first.linked_user_name ?? first.linked_user_email,
        statuses: [...statuses],
        totals: {
          imported: rows.reduce((sum, row) => sum + Number(row.imported_kwh ?? 0), 0),
          exported: rows.reduce((sum, row) => sum + Number(row.exported_kwh ?? 0), 0),
          yellow: rows.reduce((sum, row) => sum + Number(row.yellow_tokens ?? 0), 0),
          red: rows.reduce((sum, row) => sum + Number(row.red_tokens ?? 0), 0),
          bill: rows.reduce((sum, row) => sum + Number(row.estimated_bill ?? 0), 0),
        },
        latestCalculationVersion: [...rows]
          .sort((a, b) => (a.billing_cycle > b.billing_cycle ? -1 : 1))[0]
          ?.calculation_version,
      };
    });
  }, [imports]);

  const summary = useMemo(() => {
    const total = imports.length;
    const mapped = imports.filter((row) => row.linked_user_id).length;
    const calculated = imports.filter((row) => row.processing_status === "calculated" || row.processing_status === "promoted").length;
    const failed = imports.filter((row) => row.processing_status === "failed").length;
    return { total, mapped, calculated, failed };
  }, [imports]);

  const unlinkedProfiles = useMemo(() => {
    const linkedProfileIds = new Set(
      imports
        .map((row) => row.linked_user_id)
        .filter((value): value is string => Boolean(value)),
    );

    return profiles.filter((profile) => !linkedProfileIds.has(profile.id));
  }, [imports, profiles]);

  const handleRefresh = () => {
    setStatusMessage(null);
    startTransition(() => {
      getEnergyPipelineSnapshot()
        .then(({ imports: importRows, mappings: mappingRows, profiles: profileRows, latestRun: latestRunData }) => {
          setImports(importRows);
          setMappings(mappingRows);
          setProfiles(profileRows);
          setLatestRun(latestRunData);
          setError(null);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Unable to refresh pipeline data.");
        });
    });
  };

  const handleMap = (entry: typeof groupedDatasetUsers[number]) => {
    const linkedUserId = selection[entry.datasetUserCode];
    if (!linkedUserId) {
      setError(`Choose a target profile for ${entry.datasetUserCode} first.`);
      return;
    }

    setError(null);
    setStatusMessage(null);

    startTransition(() => {
      saveDatasetUserMapping(entry.datasetUserCode, linkedUserId, {
        datasetUserType: entry.datasetUserType,
        sourceFileName: entry.sourceFileName,
        notes: "Mapped from admin energy pipeline screen.",
      })
        .then(async () => {
          const snapshot = await getEnergyPipelineSnapshot();
          setImports(snapshot.imports);
          setMappings(snapshot.mappings);
          setProfiles(snapshot.profiles);
          setLatestRun(snapshot.latestRun);
          setStatusMessage(`Mapping saved for ${entry.datasetUserCode}. The Python energy pipeline can now calculate and promote this user's energy records.`);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Unable to apply mapping.");
        });
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-emerald-200/78">Energy Pipeline</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Imported dataset, mapped users, and calculation readiness</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
              This screen tracks the raw SustainX import, the legacy-logic calculation output, and the mapping required before rows can be promoted into live user energy records.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            <RefreshCcw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}
      {statusMessage ? <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">{statusMessage}</div> : null}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/46">Imported rows</p>
          <p className="mt-3 text-3xl font-semibold">{summary.total}</p>
        </div>
        <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/46">Mapped rows</p>
          <p className="mt-3 text-3xl font-semibold">{summary.mapped}</p>
        </div>
        <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/46">Calculated or promoted</p>
          <p className="mt-3 text-3xl font-semibold">{summary.calculated}</p>
        </div>
        <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/46">Failed rows</p>
          <p className="mt-3 text-3xl font-semibold">{summary.failed}</p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/75">Python Automation</p>
            <h3 className="mt-2 text-lg font-semibold">Legacy calculation engine status</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/62">
              Monthly import calculations are intended to run through the Python CEB legacy logic pipeline, not only through frontend reads. This keeps token math, green-cap checks, and promotion logic consistent.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white/72">
            {latestRun ? (
              <div className="space-y-1">
                <p className="font-medium text-white">Last run: {latestRun.status.replaceAll("_", " ")}</p>
                <p>Processed {latestRun.processed_count} of {latestRun.rows_considered} rows</p>
                <p>Promoted {latestRun.promoted_count} rows</p>
                <p>Started {formatDate(latestRun.started_at)}</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-medium text-white">No logged pipeline run yet</p>
                <p>After you enable the workflow or run the Python script, this panel will show the latest calculation cycle.</p>
              </div>
            )}
          </div>
        </div>
        {latestRun?.error_summary ? (
          <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
            {latestRun.error_summary}
          </div>
        ) : null}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="mb-5 flex items-center gap-3">
          <Link2 className="h-5 w-5 text-emerald-200" />
          <h3 className="text-lg font-semibold">Signed-up users waiting for energy linking</h3>
        </div>
        <p className="mb-4 max-w-3xl text-sm leading-6 text-white/62">
          New signups are created in profiles and wallets immediately, but they will not appear in imported energy data until you link them to a dataset code or promote new readings for them.
        </p>
        {unlinkedProfiles.length === 0 ? (
          <p className="text-sm text-white/55">Every active profile is already linked to imported energy rows.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {unlinkedProfiles.map((profile) => (
              <div key={profile.id} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                <p className="text-sm font-semibold text-white">{profile.full_name || profile.email || profile.id}</p>
                <p className="mt-1 text-sm text-white/62">{profile.email || "No email recorded"}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/40">
                  {profile.user_type} • {profile.status}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="mb-5 flex items-center gap-3">
          <Bot className="h-5 w-5 text-cyan-200" />
          <h3 className="text-lg font-semibold">Dataset user mapping</h3>
        </div>
        <div className="space-y-4">
          {groupedDatasetUsers.map((entry) => (
            <div key={entry.datasetUserCode} className="rounded-2xl border border-white/8 bg-black/15 p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-white">{entry.datasetUserCode}</p>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/60">
                      {entry.datasetUserType}
                    </span>
                    {entry.statuses.map((status) => (
                      <span
                        key={status}
                        className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${
                          status === "promoted"
                            ? "bg-emerald-500/18 text-emerald-100"
                            : status === "failed"
                              ? "bg-red-500/18 text-red-100"
                              : "bg-white/10 text-white/70"
                        }`}
                      >
                        {status}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-white/62">
                    Meter {entry.meterId} • {entry.rowCount} billing rows • source {entry.sourceFileName}
                  </p>
                  <div className="flex flex-wrap gap-4 text-sm text-white/62">
                    <span>Imported {formatAmount(entry.totals.imported, 3)} kWh</span>
                    <span>Exported {formatAmount(entry.totals.exported, 3)} kWh</span>
                    <span>Yellow {formatAmount(entry.totals.yellow)}</span>
                    <span>Red {formatAmount(entry.totals.red)}</span>
                    <span>Bill Rs {formatAmount(entry.totals.bill)}</span>
                  </div>
                  <p className="text-sm text-white/62">
                    Current mapping: {entry.linkedUserLabel ?? "Not linked yet"} • calc version {entry.latestCalculationVersion ?? "Not calculated"}
                  </p>
                </div>

                <div className="w-full max-w-xl space-y-3">
                  <label className="block text-xs uppercase tracking-[0.16em] text-white/50">Link dataset user to a real profile</label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <select
                      value={selection[entry.datasetUserCode] ?? entry.linkedUserId ?? ""}
                      onChange={(event) =>
                        setSelection((current) => ({
                          ...current,
                          [entry.datasetUserCode]: event.target.value,
                        }))
                      }
                      className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
                    >
                      <option value="">Choose a profile</option>
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {(profile.full_name || profile.email || profile.id)} • {profile.user_type}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleMap(entry)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105"
                    >
                      <Link2 className="h-4 w-4" />
                      Save mapping
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <div className="mb-5 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-200" />
            <h3 className="text-lg font-semibold">Recent imported rows</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-white/45">
                <tr>
                  <th className="px-3 py-3 font-medium">Dataset user</th>
                  <th className="px-3 py-3 font-medium">Cycle</th>
                  <th className="px-3 py-3 font-medium">Net</th>
                  <th className="px-3 py-3 font-medium">Yellow</th>
                  <th className="px-3 py-3 font-medium">Red</th>
                  <th className="px-3 py-3 font-medium">Bill</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {imports.slice(0, 18).map((row) => (
                  <tr key={row.id} className="border-t border-white/8 text-white/72">
                    <td className="px-3 py-3">{row.dataset_user_code}</td>
                    <td className="px-3 py-3">{row.billing_cycle}</td>
                    <td className="px-3 py-3">{formatAmount(row.net_kwh, 3)} kWh</td>
                    <td className="px-3 py-3">{formatAmount(row.yellow_tokens)}</td>
                    <td className="px-3 py-3">{formatAmount(row.red_tokens)}</td>
                    <td className="px-3 py-3">{formatAmount(row.estimated_bill)}</td>
                    <td className="px-3 py-3">{row.processing_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <div className="mb-5 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-200" />
            <h3 className="text-lg font-semibold">Mapped dataset codes</h3>
          </div>
          <div className="space-y-4">
            {mappings.length === 0 ? (
              <p className="text-sm text-white/55">No dataset mappings saved yet.</p>
            ) : (
              mappings.map((mapping) => (
                <div key={mapping.dataset_user_code} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <p className="text-sm font-medium text-white">{mapping.dataset_user_code}</p>
                  <p className="mt-1 text-sm text-white/62">{mapping.dataset_user_type}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-white/36">
                    Updated {formatDate(mapping.updated_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
