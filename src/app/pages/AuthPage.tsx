import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { BrandLogo } from "../components/BrandLogo";
import { getDefaultRouteForRole } from "../lib/access";
import { getStoredLanguage, setStoredLanguage } from "../lib/language";
import { useNoIndex } from "../lib/useNoIndex";
import { useAuth } from "../providers/AuthProvider";

type Language = "en" | "fr" | "cr";

export function AuthPage() {
  useNoIndex();
  const [lang, setLang] = useState<Language>(() => getStoredLanguage());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pendingLogin, setPendingLogin] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { defaultRoute, isConfigured, session, profile, isProfileLoading } = useAuth();
  const redirectTo =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? defaultRoute;

  useEffect(() => {
    setStoredLanguage(lang);
  }, [lang]);

  const copy = {
    en: {
      login: "User Login",
      email: "Email address",
      password: "Password",
      forgotPasswordTitle: "Forgot your password?",
      forgotPasswordAction: "Reset password",
      forgotPasswordHelp: "Enter your email and we will send a secure reset link.",
      forgotPasswordButton: "Send reset link",
      forgotPasswordSuccess: "If that email is registered, a password reset link is on its way. Check your inbox.",
      forgotPasswordSending: "Sending...",
      forgotPasswordPending: "Still sending the reset link. Please keep this page open for a moment.",
      loginButton: "Enter User Portal",
      tagline: "Nouvo Lenerzi, Nouvo Moris.",
      headline: "Secure access for approved SoleyVolt users.",
      subheadline:
        "User accounts are created internally by the SoleyVolt operations team. Sign in here with the credentials you received from the SoleyVolt team.",
      missingConfig:
        "Add your Supabase VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before signing in.",
      loginSuccess: "Login successful. Welcome back.",
      loginPending: "Checking your portal access...",
      loading: "Connecting...",
      backHome: "Back to home",
      secure: "Controlled onboarding only",
      fast: "Live wallet and reading sync",
      trusted: "Built for Mauritius energy exchange",
      loginIntro: "Sign in to your assigned user portal.",
      trustTitle: "Inside your portal",
      userOnlyAccess: "Public signup is disabled. Apply through the SoleyVolt website first, then sign in after your application is approved.",
      trustItems: [
        "Track production, imports, and exports in one place",
        "View your own bills, coins, and wallet activity",
        "Manage preferences, profile data, and account security",
      ],
    },
    fr: {
      login: "Connexion utilisateur",
      email: "Adresse email",
      password: "Mot de passe",
      forgotPasswordTitle: "Mot de passe oublie ?",
      forgotPasswordAction: "Reinitialiser",
      forgotPasswordHelp: "Entrez votre email et nous enverrons un lien de reinitialisation securise.",
      forgotPasswordButton: "Envoyer le lien",
      forgotPasswordSuccess: "Si cet email est enregistre, un lien de reinitialisation est en route. Verifiez votre boite mail.",
      forgotPasswordSending: "Envoi...",
      forgotPasswordPending: "Le lien de reinitialisation est en cours d'envoi. Gardez cette page ouverte un instant.",
      loginButton: "Entrer dans le portail utilisateur",
      tagline: "Nouvo Lenerzi, Nouvo Moris.",
      headline: "Acces securise pour les utilisateurs SoleyVolt approuves.",
      subheadline:
        "Les comptes utilisateur sont crees en interne par l'equipe SoleyVolt. Connectez-vous ici avec les identifiants recus de l'equipe SoleyVolt.",
      missingConfig:
        "Ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY avant de vous connecter.",
      loginSuccess: "Connexion reussie. Bon retour.",
      loginPending: "Verification de l'acces au portail...",
      loading: "Connexion...",
      backHome: "Retour a l'accueil",
      secure: "Onboarding controle uniquement",
      fast: "Synchronisation live du wallet et des releves",
      trusted: "Pense pour l'energie a Maurice",
      loginIntro: "Connectez-vous a votre portail utilisateur attribue.",
      trustTitle: "Dans votre portail",
      userOnlyAccess: "L'inscription publique est desactivee. Postulez d'abord sur le site SoleyVolt puis connectez-vous apres approbation.",
      trustItems: [
        "Suivez production, importation et exportation au meme endroit",
        "Consultez vos propres factures, coins et activite portefeuille",
        "Gerez vos preferences, votre profil et la securite du compte",
      ],
    },
    cr: {
      login: "Login user",
      email: "Adres email",
      password: "Password",
      forgotPasswordTitle: "To finn bliye to password?",
      forgotPasswordAction: "Reset password",
      forgotPasswordHelp: "Met to email ek nou pou avoy enn lien reset sekirize.",
      forgotPasswordButton: "Avoy lien reset",
      forgotPasswordSuccess: "Si sa email-la existe, enn lien reset pe al dan to mailbox. Verifye to inbox.",
      forgotPasswordSending: "Pe avoye...",
      forgotPasswordPending: "Lien reset pe avoye. Les sa paz-la ouver enn ti moman ankor.",
      loginButton: "Antre dan User Portal",
      tagline: "Nouvo Lenerzi, Nouvo Moris.",
      headline: "Aksed sekirize pou bann user SoleyVolt ki finn apouve.",
      subheadline:
        "Kont user kree an interne par lekip SoleyVolt. Konekte isi avek bann credential ki lekip SoleyVolt inn donn twa.",
      missingConfig: "Ajout VITE_SUPABASE_URL ek VITE_SUPABASE_PUBLISHABLE_KEY avan konekte.",
      loginSuccess: "Login reisi. Bon retour.",
      loginPending: "Pe verifye to akses portal...",
      loading: "Pe konekte...",
      backHome: "Retour lakaz",
      secure: "Onboarding kontrol zis an interne",
      fast: "Wallet ek reading an direk",
      trusted: "Fer pou rezo lenzerzi Moris",
      loginIntro: "Konekte dan user portal ki finn atribie pou twa.",
      trustTitle: "Dan to portal",
      userOnlyAccess: "Public signup inn retire. Premie etap se fer enn aplikasyon lor sit SoleyVolt, apre to konekte kan li finn apouve.",
      trustItems: [
        "Swiv prodiksion, import ek export dan enn sel plas",
        "Get zis to prop bill, coins ek wallet activity",
        "Manage preference, profil ek sekirite kont",
      ],
    },
  } as const;

  const currentCopy = copy[lang];

  useEffect(() => {
    if (!pendingLogin || !session || isProfileLoading) {
      return;
    }

    if (!profile) {
      void supabase?.auth.signOut();
      setPendingLogin(false);
      setMessage("");
      setError("Profile not found for this account.");
      return;
    }

    if (profile.status !== "active") {
      void supabase?.auth.signOut();
      setPendingLogin(false);
      setMessage("");
      setError("Your account is not active right now.");
      return;
    }

    setPendingLogin(false);
    setIsSubmitting(false);
    setMessage("");
    toast.success(currentCopy.loginSuccess);
    navigate(getDefaultRouteForRole(profile.role) || redirectTo, { replace: true });
  }, [currentCopy.loginSuccess, isProfileLoading, navigate, pendingLogin, profile, redirectTo, session]);

  const portalStats = [
    { icon: ShieldCheck, label: currentCopy.secure },
    { icon: Sparkles, label: currentCopy.fast },
    { icon: Wallet, label: currentCopy.trusted },
  ];

  const getResetRedirectUrl = () => `${window.location.origin}/auth/reset`;

  const handleForgotPassword = async () => {
    setError("");
    setMessage("");

    if (!isConfigured || !supabase) {
      setError(currentCopy.missingConfig);
      return;
    }

    const targetEmail = forgotPasswordEmail.trim() || email.trim();

    if (!targetEmail) {
      setError(currentCopy.email);
      return;
    }

    setIsSendingReset(true);
    let slowResetTimer: number | undefined;

    try {
      slowResetTimer = window.setTimeout(() => {
        setMessage(currentCopy.forgotPasswordPending);
      }, 5000);

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: getResetRedirectUrl(),
      });

      if (resetError) {
        throw resetError;
      }

      setForgotPasswordEmail(targetEmail);
      toast.success(currentCopy.forgotPasswordSuccess);
      setMessage(currentCopy.forgotPasswordSuccess);
    } catch (err) {
      if (err instanceof Error && /rate limit/i.test(err.message)) {
        toast.success(currentCopy.forgotPasswordSuccess);
        setMessage(currentCopy.forgotPasswordSuccess);
        return;
      }

      setMessage("");
      setError(err instanceof Error ? err.message : "The request could not be completed. Please try again.");
    } finally {
      if (slowResetTimer) {
        window.clearTimeout(slowResetTimer);
      }
      setIsSendingReset(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!isConfigured || !supabase) {
      setError(currentCopy.missingConfig);
      return;
    }

    setIsSubmitting(true);
    let slowAuthTimer: number | undefined;

    try {
      slowAuthTimer = window.setTimeout(() => {
        setMessage(currentCopy.loginPending);
      }, 3500);

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        throw signInError;
      }

      setMessage(currentCopy.loginPending);
      setPendingLogin(true);
    } catch (err) {
      setPendingLogin(false);
      setMessage("");
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsSubmitting(false);
    } finally {
      if (slowAuthTimer) {
        window.clearTimeout(slowAuthTimer);
      }
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07142b] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.22),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.18),_transparent_28%),linear-gradient(135deg,_#07142b_10%,_#0b2b57_48%,_#052f2a_100%)]" />
      <div className="absolute inset-y-0 left-[-8%] w-72 rotate-12 bg-white/5 blur-3xl" />
      <div className="absolute inset-y-0 right-[-5%] w-80 -rotate-12 bg-amber-300/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/90 transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            {currentCopy.backHome}
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">
              <Globe2 className="h-4 w-4 text-amber-300" />
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as Language)}
                className="bg-transparent text-sm text-white outline-none"
              >
                <option value="en" className="text-slate-900">EN</option>
                <option value="fr" className="text-slate-900">FR</option>
                <option value="cr" className="text-slate-900">CR</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid flex-1 items-center gap-8 lg:grid-cols-[1.12fr_0.88fr]">
          <section className="hidden lg:block">
            <div className="max-w-xl">
              <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-sm text-amber-100 backdrop-blur">
                <BrandLogo className="h-4 w-4 object-contain" />
                {currentCopy.tagline}
              </div>

              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden">
                  <BrandLogo className="h-full w-full object-contain" />
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-tight">SoleyVolt</p>
                  <p className="text-sm text-white/65">User Portal</p>
                </div>
              </div>

              <h1 className="max-w-lg text-5xl font-semibold leading-tight tracking-tight text-white">
                {currentCopy.headline}
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-white/70">{currentCopy.subheadline}</p>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {portalStats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-white/6 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.18)] backdrop-blur"
                  >
                    <item.icon className="mb-3 h-5 w-5 text-amber-300" />
                    <p className="text-sm leading-6 text-white/80">{item.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.22)] backdrop-blur">
                <p className="mb-4 text-sm uppercase tracking-[0.22em] text-amber-200/80">
                  {currentCopy.trustTitle}
                </p>
                <div className="space-y-4">
                  {currentCopy.trustItems.map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                      <p className="text-sm leading-6 text-white/78">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-xl lg:max-w-none">
            <div className="rounded-[2rem] border border-white/12 bg-white/[0.08] p-4 shadow-[0_25px_100px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-6">
              <div className="rounded-[1.65rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.93))] p-6 text-slate-900 shadow-inner sm:p-8">
                <div className="mb-6 lg:hidden">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden">
                      <BrandLogo className="h-full w-full object-contain" />
                    </div>
                    <div>
                      <p className="text-xl font-semibold">SoleyVolt</p>
                      <p className="text-sm text-slate-500">{currentCopy.tagline}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{currentCopy.subheadline}</p>
                </div>

                <div className="mb-6">
                  <h2 className="text-3xl font-semibold tracking-tight text-slate-950">{currentCopy.login}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{currentCopy.loginIntro}</p>
                </div>

                <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                  {currentCopy.userOnlyAccess}
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
                    <label className="mb-2 block text-sm font-medium text-slate-700">{currentCopy.email}</label>
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-amber-400 focus-within:ring-4 focus-within:ring-amber-100">
                      <Mail className="h-5 w-5 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">{currentCopy.password}</label>
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-amber-400 focus-within:ring-4 focus-within:ring-amber-100">
                      <LockKeyhole className="h-5 w-5 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                        placeholder="Enter your password"
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

                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <span>{currentCopy.secure}</span>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword((current) => !current)}
                      className="font-medium text-amber-700 transition hover:text-amber-800"
                    >
                      {currentCopy.forgotPasswordAction}
                    </button>
                  </div>

                  {showForgotPassword ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                      <p className="text-sm font-medium text-amber-950">{currentCopy.forgotPasswordTitle}</p>
                      <p className="mt-1 text-sm leading-6 text-amber-900/80">{currentCopy.forgotPasswordHelp}</p>
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                        <input
                          type="email"
                          value={forgotPasswordEmail}
                          onChange={(e) => setForgotPasswordEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                        />
                        <button
                          type="button"
                          onClick={handleForgotPassword}
                          disabled={isSendingReset}
                          className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isSendingReset ? currentCopy.forgotPasswordSending : currentCopy.forgotPasswordButton}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#f2b61f,#f59e0b,#1f8f74)] px-6 py-4 text-sm font-semibold text-slate-950 shadow-[0_18px_40px_rgba(245,158,11,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
                        {currentCopy.loading}
                      </>
                    ) : (
                      <>
                        <BrandLogo className="h-5 w-5 object-contain" />
                        {currentCopy.loginButton}
                      </>
                    )}
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
