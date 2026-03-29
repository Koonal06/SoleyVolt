import { ArrowLeft, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { BrandLogo } from "../components/BrandLogo";
import { useNoIndex } from "../lib/useNoIndex";
import { useAuth } from "../providers/AuthProvider";

export function ResetPasswordPage() {
  useNoIndex();
  const navigate = useNavigate();
  const { isConfigured, isLoading, session } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const canResetPassword = useMemo(() => Boolean(session?.user), [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isConfigured || !supabase) {
      setError("Supabase is not configured yet.");
      return;
    }

    if (!canResetPassword) {
      setError("Open this page from the password reset link sent to your email.");
      return;
    }

    if (!password.trim()) {
      setError("Enter a new password.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        throw updateError;
      }

      await supabase.auth.signOut();
      toast.success("Password updated successfully. Please sign in with your new password.");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#07142b] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.2),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.18),_transparent_28%),linear-gradient(135deg,_#07142b_10%,_#0b2b57_48%,_#052f2a_100%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1fr_460px]">
          <section className="hidden lg:block">
            <div className="max-w-xl">
              <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-sm text-amber-100">
                <ShieldCheck className="h-4 w-4" />
                Password Recovery
              </div>

              <h1 className="text-5xl font-semibold tracking-tight text-white">
                Choose a new password and return to your SoleyVolt portal.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-white/68">
                Use the secure recovery link from your email, set a fresh password, then sign in again.
              </p>
            </div>
          </section>

          <section>
            <div className="rounded-[2rem] border border-white/12 bg-white/[0.08] p-4 shadow-[0_25px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-6">
              <div className="rounded-[1.65rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.93))] p-6 text-slate-900 shadow-inner sm:p-8">
                <div className="mb-8 flex items-center justify-between">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to login
                  </Link>

                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                    <BrandLogo className="h-4 w-4 object-contain" />
                    Reset Password
                  </div>
                </div>

                <div className="mb-6">
                  <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Create a new password</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {isLoading
                      ? "Checking your recovery session..."
                      : canResetPassword
                        ? "Enter your new password below."
                        : "Open this page from the reset link sent to your email."}
                  </p>
                </div>

                {error ? (
                  <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                {!isLoading && !canResetPassword ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Password reset links only work after you open the email from Supabase Auth.
                  </div>
                ) : null}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">New password</label>
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-amber-400 focus-within:ring-4 focus-within:ring-amber-100">
                      <LockKeyhole className="h-5 w-5 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                        placeholder="Enter your new password"
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

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Confirm new password</label>
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-amber-400 focus-within:ring-4 focus-within:ring-amber-100">
                      <ShieldCheck className="h-5 w-5 text-slate-400" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                        placeholder="Repeat your new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((current) => !current)}
                        className="text-slate-400 transition hover:text-slate-700"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || isLoading || !canResetPassword}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#f2b61f,#f59e0b,#1f8f74)] px-6 py-4 text-sm font-semibold text-slate-950 shadow-[0_18px_40px_rgba(245,158,11,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? "Updating password..." : "Save new password"}
                  </button>
                </form>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
