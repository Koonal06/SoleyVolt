import { useEffect, useMemo, useState } from "react";
import { Settings2 } from "lucide-react";
import { getGreenCoinMarket, useCoinSettings } from "../../lib/green-coin-market";
import { updateCoinSettings } from "../../lib/supabase-data";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatSavedAt(value: string | null | undefined) {
  if (!value) {
    return "Not saved yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export function AdminSettingsPage() {
  const { settings: persistedSettings, error: loadError, refreshSettings } = useCoinSettings();
  const [settings, setSettings] = useState({
    greenCoinPrice: "1.25",
    redCoinFactor: "0.80",
    yellowCoinFactor: "0.50",
    yellowCoinBillOffsetFactor: "0.20",
    greenCoinBillOffsetFactor: "1.00",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!persistedSettings || isDirty) {
      return;
    }

    setSettings({
      greenCoinPrice: String(persistedSettings.green_coin_unit_price),
      redCoinFactor: String(persistedSettings.red_coin_rate),
      yellowCoinFactor: String(persistedSettings.yellow_coin_rate),
      yellowCoinBillOffsetFactor: String(persistedSettings.yellow_coin_bill_offset_rate),
      greenCoinBillOffsetFactor: String(persistedSettings.green_coin_bill_offset_rate),
    });
  }, [isDirty, persistedSettings]);

  const marketPreview = useMemo(
    () => getGreenCoinMarket(Number(settings.greenCoinPrice)),
    [settings.greenCoinPrice],
  );

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setStatus(null);

      const savedSettings = await updateCoinSettings({
        green_coin_unit_price: Number(settings.greenCoinPrice),
        red_coin_rate: Number(settings.redCoinFactor),
        yellow_coin_rate: Number(settings.yellowCoinFactor),
        yellow_coin_bill_offset_rate: Number(settings.yellowCoinBillOffsetFactor),
        green_coin_bill_offset_rate: Number(settings.greenCoinBillOffsetFactor),
      });
      await refreshSettings();

      setIsDirty(false);
      setStatus(`Admin coin settings saved. Last saved ${formatSavedAt(savedSettings?.updated_at)}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Unable to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <h2 className="text-2xl font-semibold tracking-tight">Admin settings</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
          Configure pricing assumptions and operational settings used by the protected SoleyVolt staff portals.
        </p>
      </section>

      {status ? <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-50">{status}</div> : null}
      {loadError ? <div className="rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-sm leading-6 text-red-50">{loadError}</div> : null}

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="mb-5 flex items-center gap-3">
          <Settings2 className="h-5 w-5 text-emerald-200" />
          <div>
            <h3 className="text-lg font-semibold">Prototype controls</h3>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-white/40">
              Last saved: {formatSavedAt(persistedSettings?.updated_at)}
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { key: "greenCoinPrice", label: "Green Coin price", suffix: "currency / coin" },
            { key: "redCoinFactor", label: "Red Coin conversion", suffix: "RC / kWh" },
            { key: "yellowCoinFactor", label: "Yellow Coin conversion", suffix: "YC / kWh" },
            { key: "yellowCoinBillOffsetFactor", label: "Yellow Coin bill offset", suffix: "RC offset / YC" },
            { key: "greenCoinBillOffsetFactor", label: "Green Coin bill offset", suffix: "RC offset / GC" },
          ].map((field) => (
            <label key={field.key} className="block">
              <span className="mb-2 block text-sm text-white/62">{field.label}</span>
              <div className="flex items-center rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <input
                  type="number"
                  value={settings[field.key as keyof typeof settings]}
                  onChange={(e) => {
                    setIsDirty(true);
                    setStatus(null);
                    setSettings((current) => ({
                      ...current,
                      [field.key]: e.target.value,
                    }));
                  }}
                  className="w-full bg-transparent text-sm text-white outline-none"
                />
                <span className="text-xs uppercase tracking-[0.14em] text-white/36">{field.suffix}</span>
              </div>
            </label>
          ))}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-300/16 bg-emerald-400/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-emerald-100/72">Live landing price</p>
            <p className="mt-2 text-2xl font-semibold text-white">{numberFormatter.format(marketPreview.livePrice)}</p>
            <p className="mt-2 text-sm text-white/60">
              {marketPreview.phaseLabel} {marketPreview.changePercent >= 0 ? "+" : ""}
              {marketPreview.changePercent.toFixed(1)}%
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-white/42">Admin base price</p>
            <p className="mt-2 text-2xl font-semibold text-white">{numberFormatter.format(marketPreview.basePrice)}</p>
            <p className="mt-2 text-sm text-white/60">This is the value you save in settings.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-white/42">Mauritius market clock</p>
            <p className="mt-2 text-2xl font-semibold text-white">{marketPreview.clockLabel}</p>
            <p className="mt-2 text-sm text-white/60">Night demand lifts the quote, morning demand softens it.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="mt-6 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSaving ? "Saving..." : "Save coin settings"}
        </button>
      </section>
    </div>
  );
}
