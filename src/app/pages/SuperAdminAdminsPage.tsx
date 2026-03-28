import { useEffect, useState } from "react";
import { ShieldPlus } from "lucide-react";
import { toast } from "sonner";
import type { ProfileRow } from "../../lib/supabase-data";
import { createManagedAdminAccount, getManagedAdminAccounts } from "../../lib/server-api";

type Language = "en" | "fr" | "cr";

export function SuperAdminAdminsPage() {
  const [admins, setAdmins] = useState<ProfileRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    language: "en" as Language,
    status: "active" as "active" | "inactive" | "suspended",
  });

  useEffect(() => {
    let active = true;

    getManagedAdminAccounts()
      .then((data) => {
        if (active) {
          setAdmins(data);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load admin accounts.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await createManagedAdminAccount({
        full_name: form.fullName,
        email: form.email,
        password: form.password,
        language: form.language,
        status: form.status,
      });

      toast.success(`Admin account created for ${response.user.email}.`);
      setAdmins((current) => [
        ...current,
        {
          id: response.user.id,
          email: response.user.email,
          full_name: form.fullName,
          role: "admin",
          user_type: "prosumer",
          status: form.status,
          language: form.language,
          phone: null,
          avatar_url: null,
          created_by: null,
        },
      ]);
      setForm({
        fullName: "",
        email: "",
        password: "",
        language: "en",
        status: "active",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create admin account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="flex items-center gap-3">
          <ShieldPlus className="h-5 w-5 text-amber-200" />
          <h2 className="text-2xl font-semibold tracking-tight">Admin governance</h2>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
          Super admins create and supervise admin operators here. Public admin signup has been removed from the platform.
        </p>
      </section>

      {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <h3 className="text-lg font-semibold">Create admin account</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
          Create an internal admin account with a temporary password. The new admin can access only the admin portal after activation.
        </p>

        <form onSubmit={handleCreateAdmin} className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm text-white/62">Full name</span>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setForm((current) => ({ ...current, fullName: e.target.value }))}
              required
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
              placeholder="Admin User"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-white/62">Admin email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
              required
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
              placeholder="admin@soleyvolt.com"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-white/62">Temporary password</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
              required
              minLength={8}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
              placeholder="At least 8 characters"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-white/62">Language</span>
            <select
              value={form.language}
              onChange={(e) => setForm((current) => ({ ...current, language: e.target.value as Language }))}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="en" className="text-slate-950">English</option>
              <option value="fr" className="text-slate-950">Francais</option>
              <option value="cr" className="text-slate-950">Kreol</option>
            </select>
          </label>

          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm text-white/62">Status</span>
            <select
              value={form.status}
              onChange={(e) => setForm((current) => ({ ...current, status: e.target.value as "active" | "inactive" | "suspended" }))}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="active" className="text-slate-950">Active</option>
              <option value="inactive" className="text-slate-950">Inactive</option>
              <option value="suspended" className="text-slate-950">Suspended</option>
            </select>
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Creating admin..." : "Create admin account"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <h3 className="text-lg font-semibold">Current admin accounts</h3>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.18em] text-white/42">
                <th className="px-0 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Language</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id} className="border-b border-white/6 text-sm last:border-b-0">
                  <td className="px-0 py-4 text-white">{admin.full_name || "Unnamed admin"}</td>
                  <td className="px-4 py-4 text-white/62">{admin.email ?? "No email"}</td>
                  <td className="px-4 py-4 capitalize text-white/62">{admin.role.replace("_", " ")}</td>
                  <td className="px-4 py-4 capitalize text-white/62">{admin.status}</td>
                  <td className="px-4 py-4 uppercase text-white/62">{admin.language}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
