import { useEffect, useState } from "react";
import { Settings2, ShieldPlus } from "lucide-react";
import { getCoinSettings, updateCoinSettings } from "../../lib/supabase-data";
import { serverApiRequest } from "../../lib/server-api";

export function AdminSettingsPage() {
  const [settings, setSettings] = useState({
    greenCoinPrice: "1.25",
    redCoinFactor: "0.80",
    yellowCoinFactor: "0.50",
    yellowCoinBillOffsetFactor: "0.20",
    greenCoinBillOffsetFactor: "1.00",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [adminStatus, setAdminStatus] = useState<string | null>(null);
  const [adminStatusTone, setAdminStatusTone] = useState<"success" | "error">("success");
  const [adminForm, setAdminForm] = useState({
    fullName: "",
    email: "",
    password: "",
    language: "en" as "en" | "fr" | "cr",
  });

  useEffect(() => {
    let active = true;

    getCoinSettings()
      .then((data) => {
        if (!active || !data) {
          return;
        }

        setSettings({
          greenCoinPrice: String(data.green_coin_unit_price),
          redCoinFactor: String(data.red_coin_rate),
          yellowCoinFactor: String(data.yellow_coin_rate),
          yellowCoinBillOffsetFactor: String(data.yellow_coin_bill_offset_rate),
          greenCoinBillOffsetFactor: String(data.green_coin_bill_offset_rate),
        });
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setStatus(null);

      await updateCoinSettings({
        green_coin_unit_price: Number(settings.greenCoinPrice),
        red_coin_rate: Number(settings.redCoinFactor),
        yellow_coin_rate: Number(settings.yellowCoinFactor),
        yellow_coin_bill_offset_rate: Number(settings.yellowCoinBillOffsetFactor),
        green_coin_bill_offset_rate: Number(settings.greenCoinBillOffsetFactor),
      });

      setStatus("Admin coin settings saved.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Unable to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdminCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    const confirmed = window.confirm(
      `Create a new admin account for ${adminForm.email}?\n\nThis will grant full admin portal access.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsCreatingAdmin(true);
      setAdminStatus(null);
      setAdminStatusTone("success");

      await serverApiRequest<{ user: { id: string; email: string } }>("/admin/create-user", {
        method: "POST",
        body: {
          full_name: adminForm.fullName,
          email: adminForm.email,
          password: adminForm.password,
          language: adminForm.language,
        },
      });

      setAdminStatus(
        `Admin account created for ${adminForm.email}. Share the temporary password securely and require the new admin to change it immediately after first login.`,
      );
      setAdminForm({
        fullName: "",
        email: "",
        password: "",
        language: "en",
      });
    } catch (err) {
      setAdminStatusTone("error");
      setAdminStatus(err instanceof Error ? err.message : "Unable to create admin account.");
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <h2 className="text-2xl font-semibold tracking-tight">Admin settings</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
          Configure pricing assumptions and monitoring thresholds used by the hackathon admin portal experience.
        </p>
      </section>

      {status ? <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-50">{status}</div> : null}

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="mb-5 flex items-center gap-3">
          <Settings2 className="h-5 w-5 text-emerald-200" />
          <h3 className="text-lg font-semibold">Prototype controls</h3>
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
                  onChange={(e) =>
                    setSettings((current) => ({
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
          disabled={isSaving}
          className="mt-6 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSaving ? "Saving..." : "Save coin settings"}
        </button>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="mb-5 flex items-center gap-3">
          <ShieldPlus className="h-5 w-5 text-emerald-200" />
          <h3 className="text-lg font-semibold">Create admin account</h3>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-white/65">
          This form is only available inside the admin portal. It creates a new authenticated user and immediately marks that profile as an active admin.
        </p>

        <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50">
          Temporary password notice: after you create the admin, send the password through a secure channel and tell them to change it on first login from their settings page.
        </div>

        {adminStatus ? (
          <div
            className={`mt-4 rounded-2xl p-4 text-sm leading-6 ${
              adminStatusTone === "success"
                ? "border border-emerald-300/20 bg-emerald-400/10 text-emerald-50"
                : "border border-red-400/30 bg-red-500/10 text-red-100"
            }`}
          >
            {adminStatus}
          </div>
        ) : null}

        <form onSubmit={handleAdminCreate} className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm text-white/62">Full name</span>
            <div className="flex items-center rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <input
                type="text"
                value={adminForm.fullName}
                onChange={(e) =>
                  setAdminForm((current) => ({
                    ...current,
                    fullName: e.target.value,
                  }))
                }
                placeholder="Admin User"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-white/62">Admin email</span>
            <div className="flex items-center rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <input
                type="email"
                required
                value={adminForm.email}
                onChange={(e) =>
                  setAdminForm((current) => ({
                    ...current,
                    email: e.target.value,
                  }))
                }
                placeholder="admin@soleyvolt.com"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-white/62">Temporary password</span>
            <div className="flex items-center rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <input
                type="password"
                required
                minLength={8}
                value={adminForm.password}
                onChange={(e) =>
                  setAdminForm((current) => ({
                    ...current,
                    password: e.target.value,
                  }))
                }
                placeholder="At least 8 characters"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-white/62">Language</span>
            <div className="flex items-center rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <select
                value={adminForm.language}
                onChange={(e) =>
                  setAdminForm((current) => ({
                    ...current,
                    language: e.target.value as "en" | "fr" | "cr",
                  }))
                }
                className="w-full bg-transparent text-sm text-white outline-none"
              >
                <option value="en" className="text-slate-950">
                  English
                </option>
                <option value="fr" className="text-slate-950">
                  Francais
                </option>
                <option value="cr" className="text-slate-950">
                  Kreol
                </option>
              </select>
            </div>
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isCreatingAdmin}
              className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isCreatingAdmin ? "Creating admin..." : "Create admin account"}
            </button>
            <p className="mt-3 text-xs uppercase tracking-[0.14em] text-white/38">
              You will be asked to confirm before this admin account is created.
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}
