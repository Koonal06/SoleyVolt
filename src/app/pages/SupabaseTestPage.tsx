import { Database, ShieldCheck, UserRound, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { getMyProfile, getMyWallet, type ProfileRow, type WalletRow } from "../../lib/supabase-data";
import { supabase } from "../../lib/supabase";

type ConnectionState = {
  authEmail: string | null;
  profile: ProfileRow | null;
  wallet: WalletRow | null;
  error: string | null;
  checkedAt: string | null;
};

export function SupabaseTestPage() {
  const [state, setState] = useState<ConnectionState>({
    authEmail: null,
    profile: null,
    wallet: null,
    error: null,
    checkedAt: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function runChecks() {
      try {
        setIsLoading(true);

        const {
          data: { user },
          error: userError,
        } = await supabase!.auth.getUser();

        if (userError) {
          throw userError;
        }

        const [profile, wallet] = await Promise.all([getMyProfile(), getMyWallet()]);

        if (!active) {
          return;
        }

        setState({
          authEmail: user?.email ?? null,
          profile,
          wallet,
          error: null,
          checkedAt: new Date().toISOString(),
        });
      } catch (err) {
        if (!active) {
          return;
        }

        setState({
          authEmail: null,
          profile: null,
          wallet: null,
          error: err instanceof Error ? err.message : "Unable to reach Supabase.",
          checkedAt: new Date().toISOString(),
        });
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void runChecks();

    return () => {
      active = false;
    };
  }, []);

  const cards = [
    {
      icon: ShieldCheck,
      title: "Auth session",
      value: state.authEmail ?? (isLoading ? "Checking..." : "No active user"),
      helper: "Verifies the current Supabase auth session.",
    },
    {
      icon: UserRound,
      title: "Profile row",
      value: state.profile ? `${state.profile.role} / ${state.profile.status}` : isLoading ? "Checking..." : "Not found",
      helper: "Reads the signed-in user's profile from public.profiles.",
    },
    {
      icon: Wallet,
      title: "Wallet row",
      value: state.wallet ? `${state.wallet.balance} SLT` : isLoading ? "Checking..." : "Not found",
      helper: "Reads the signed-in user's wallet from public.wallets.",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Supabase Connection Test</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Quick health check for auth, profile access, and wallet access inside the live app.
            </p>
          </div>
        </div>
      </section>

      {state.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {state.error}
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {isLoading ? "Running Supabase checks..." : "Supabase checks completed successfully."}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <div key={card.title} className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <card.icon className="h-5 w-5" />
            </div>
            <p className="text-sm uppercase tracking-[0.18em] text-slate-500">{card.title}</p>
            <p className="mt-3 text-xl font-semibold text-slate-950">{card.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{card.helper}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-950">Returned data</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-950 p-4 text-xs text-emerald-200">
            <p className="mb-3 uppercase tracking-[0.18em] text-emerald-300/75">Profile</p>
            <pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(state.profile, null, 2)}</pre>
          </div>
          <div className="rounded-2xl bg-slate-950 p-4 text-xs text-emerald-200">
            <p className="mb-3 uppercase tracking-[0.18em] text-emerald-300/75">Wallet</p>
            <pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(state.wallet, null, 2)}</pre>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          Last checked: {state.checkedAt ? new Date(state.checkedAt).toLocaleString() : "Not run yet"}
        </p>
      </section>
    </div>
  );
}
