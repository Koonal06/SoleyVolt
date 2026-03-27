import { useState } from "react";
import { Settings2 } from "lucide-react";

type RuleDraft = {
  importRate: string;
  exportRate: string;
  transferFee: string;
  anomalyThreshold: string;
};

const defaultDraft: RuleDraft = {
  importRate: "0.85",
  exportRate: "1.20",
  transferFee: "0.50",
  anomalyThreshold: "250",
};

export function RulesPricing() {
  const [draft, setDraft] = useState<RuleDraft>(defaultDraft);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const handleSave = () => {
    setSavedAt(
      new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date()),
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <h2 className="text-2xl font-semibold tracking-tight">Rules and pricing management</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
          Define the operator-facing rule set used to reason about pricing, transfer fees, and anomaly thresholds.
        </p>
      </section>

      <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50">
        This screen is a control-panel UI draft. It does not persist to Supabase yet because the backend pricing and rules tables are not present in this project.
      </div>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <div className="mb-5 flex items-center gap-3">
            <Settings2 className="h-5 w-5 text-emerald-200" />
            <h3 className="text-lg font-semibold">Policy draft</h3>
          </div>

          <div className="space-y-4">
            {[
              { key: "importRate", label: "Import token rate", suffix: "SLT / kWh" },
              { key: "exportRate", label: "Export reward rate", suffix: "SLT / kWh" },
              { key: "transferFee", label: "Transfer fee", suffix: "SLT" },
              { key: "anomalyThreshold", label: "Flag threshold", suffix: "SLT event size" },
            ].map((field) => (
              <label key={field.key} className="block">
                <span className="mb-2 block text-sm text-white/62">{field.label}</span>
                <div className="flex items-center rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <input
                    type="number"
                    value={draft[field.key as keyof RuleDraft]}
                    onChange={(e) =>
                      setDraft((current) => ({
                        ...current,
                        [field.key]: e.target.value,
                      }))
                    }
                    className="w-full bg-transparent text-sm text-white outline-none"
                  />
                  <span className="text-xs uppercase tracking-[0.14em] text-white/36">{field.suffix}</span>
                </div>
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="mt-6 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
          >
            Save draft
          </button>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold">Governance notes</h3>
          <div className="mt-5 space-y-4 text-sm leading-6 text-white/62">
            <p>Use import and export rates to model how energy movement should influence token issuance or redemption.</p>
            <p>Transfer fee controls can support anti-spam behavior, operational cost recovery, or market design experiments.</p>
            <p>The anomaly threshold can drive alerting when an individual event or wallet movement exceeds expected operational limits.</p>
            <p>{savedAt ? `Draft last reviewed on ${savedAt}.` : "No draft save has been recorded in this session yet."}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
