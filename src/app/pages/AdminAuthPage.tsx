import {
  ArrowLeft,
  BarChart3,
  ClipboardCheck,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { BrandLogo } from "../components/BrandLogo";
import { getDefaultRouteForRole } from "../lib/access";
import { useNoIndex } from "../lib/useNoIndex";
import { useAuth } from "../providers/AuthProvider";

export function AdminAuthPage() {
  useNoIndex();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<"admin" | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { isConfigured, session, profile, isProfileLoading } = useAuth();

  const redirectTo =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/admin/dashboard";

  const getErrorMessage = (err: unknown) => {
    if (err && typeof err === "object") {
      const maybeMessage =
        "message" in err && typeof err.message === "string"
          ? err.message
          : "error_description" in err && typeof err.error_description === "string"
            ? err.error_description
            : "error" in err && typeof err.error === "string"
              ? err.error
              : null;

      if (maybeMessage) {
        return maybeMessage;
      }
    }

    if (err instanceof Error) {
      return err.message;
    }

    if (typeof err === "string") {
      return err;
    }

    return "Unable to sign in.";
  };

  useEffect(() => {
    if (!pendingLogin || !session || isProfileLoading) {
      return;
    }

    if (!profile) {
      void supabase?.auth.signOut();
      setPendingLogin(null);
      setIsSubmitting(false);
      setMessage("");
      setError("Profile not found for this admin account.");
      return;
    }

    if (profile.role === "user") {
      void supabase?.auth.signOut();
      setPendingLogin(null);
      setIsSubmitting(false);
      setMessage("");
      setError("This login is not for user accounts. Please use the user login page.");
      return;
    }

    if (profile.status !== "active") {
      void supabase?.auth.signOut();
      setPendingLogin(null);
      setIsSubmitting(false);
      setMessage("");
      setError("Your admin account is not active.");
      return;
    }

    setPendingLogin(null);
    setIsSubmitting(false);
    setMessage("");
    toast.success("Admin login successful.");
    navigate(getDefaultRouteForRole(profile.role) || redirectTo, { replace: true });
  }, [isProfileLoading, navigate, pendingLogin, profile, redirectTo, session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!isConfigured || !supabase) {
      setError("Supabase is not configured yet.");
      return;
    }

    setIsSubmitting(true);
    let slowAuthTimer: number | undefined;

    try {
      slowAuthTimer = window.setTimeout(() => {
        setMessage("Checking admin permissions...");
      }, 3500);

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        throw signInError;
      }
      setMessage("Checking admin permissions...");
      setPendingLogin("admin");
    } catch (err) {
      setPendingLogin(null);
      setIsSubmitting(false);
      setMessage("");
      setError(getErrorMessage(err));
    } finally {
      if (slowAuthTimer) {
        window.clearTimeout(slowAuthTimer);
      }
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#08111d] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.12),_transparent_22%),linear-gradient(180deg,_#040810_0%,_#0a1420_45%,_#13263a_100%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1fr_460px]">
          <section className="hidden lg:block">
            <div className="max-w-xl">
              <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">
                <ShieldCheck className="h-4 w-4" />
                Restricted Administrative Access
              </div>

              <h1 className="text-5xl font-semibold tracking-tight text-white">
                SoleyVolt admin portal for monitoring, control, and regulation.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-white/68">
                Sign in with an authorized admin account to review system-wide activity, token circulation, alerts, and policy controls.
              </p>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {[
                  {
                    icon: BarChart3,
                    label: "System-wide dashboards",
                  },
                  {
                    icon: UsersRound,
                    label: "User and transaction oversight",
                  },
                  {
                    icon: ClipboardCheck,
                    label: "Traceable regulatory controls",
                  },
                ].map((item) => (
                  <div key={item} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                    <item.icon className="mb-4 h-5 w-5 text-emerald-200" />
                    <p className="text-sm leading-6 text-white/78">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <div className="rounded-[2rem] border border-white/10 bg-white/6 p-4 shadow-[0_25px_90px_rgba(0,0,0,0.32)] backdrop-blur-xl sm:p-6">
              <div className="rounded-[1.7rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(241,245,249,0.95))] p-6 text-slate-900 sm:p-8">
                <div className="mb-8 flex items-center justify-between">
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Link>

                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                    <BrandLogo className="h-4 w-4 object-contain" />
                    Admin Login
                  </div>
                </div>

                <div className="mb-6">
                  <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Admin portal access</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Only internally created admin or super admin accounts can continue. Public signup is disabled.
                  </p>
                </div>

                {error ? (
                  <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                {message ? (
                  <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {message}
                  </div>
                ) : null}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Admin email</label>
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-100">
                      <Mail className="h-5 w-5 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                        placeholder="admin@soleyvolt.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-100">
                      <LockKeyhole className="h-5 w-5 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                        placeholder="Enter admin password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="text-slate-400 transition hover:text-slate-700"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#10b981,#34d399,#f59e0b)] px-6 py-4 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? "Checking access..." : "Enter Admin Portal"}
                  </button>
                </form>

                <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                  User access remains available at <Link to="/login" className="font-medium text-emerald-700">/login</Link>.
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
