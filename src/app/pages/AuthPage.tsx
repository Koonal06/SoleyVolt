import {
  ArrowLeft,
  BadgeDollarSign,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe2,
  Leaf,
  LockKeyhole,
  Mail,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { getMyProfile } from "../../lib/supabase-data";
import { BrandLogo } from "../components/BrandLogo";
import { useAuth } from "../providers/AuthProvider";
import type { UserType } from "../../lib/supabase-data";
import { getStoredLanguage, setStoredLanguage } from "../lib/language";

type Language = "en" | "fr" | "cr";

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [lang, setLang] = useState<Language>(() => getStoredLanguage());
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    userType: "prosumer" as UserType,
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const location = useLocation();
  const { defaultRoute, isConfigured } = useAuth();
  const redirectTo =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? defaultRoute;

  useEffect(() => {
    setStoredLanguage(lang);
  }, [lang]);

  const copy = {
    en: {
      login: "Login",
      signup: "Sign Up",
      email: "Email address",
      password: "Password",
      confirmPassword: "Confirm password",
      forgotPassword: "Password reset will be added next.",
      forgotPasswordTitle: "Forgot your password?",
      forgotPasswordAction: "Reset password",
      forgotPasswordHelp: "Enter your email and we will send a secure reset link.",
      forgotPasswordButton: "Send reset link",
      forgotPasswordSuccess: "If that email is registered, a password reset link is on its way. Check your inbox.",
      forgotPasswordSending: "Sending...",
      forgotPasswordTimeout: "The reset request is taking too long. Please try again in a moment.",
      noAccount: "New to SoleyVolt?",
      hasAccount: "Already with us?",
      loginButton: "Enter Portal",
      signupButton: "Create Account",
      tagline: "Nouvo Lenerzi, Nouvo Moris.",
      headline: "Your energy wallet, identity, and transfers in one secure portal.",
      subheadline:
        "Sign in to monitor solar performance, manage your SLT balance, and move value instantly across the network.",
      missingConfig:
        "Add your Supabase VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before signing in.",
      passwordMismatch: "Passwords do not match.",
      signupSuccess: "Account created. Check your email for the confirmation link, then sign in.",
      loginSuccess: "Login successful. Welcome back.",
      loading: "Connecting...",
      backHome: "Back to home",
      adminAccess: "Admin access",
      secure: "Secure Supabase auth",
      fast: "Real-time token activity",
      trusted: "Built for Mauritius energy exchange",
      loginIntro: "Welcome back. Pick up where your wallet left off.",
      signupIntro: "Create your account and unlock your energy wallet.",
      usageTitle: "How will you use SoleyVolt?",
      usageHelp: "Choose the profile that best matches your energy usage. This shapes your dashboard after login.",
      switchToLogin: "Login",
      switchToSignup: "Sign Up",
      trustTitle: "Inside your portal",
      userOnlyAccess: "User portal access only. Admin accounts must sign in from the admin login page.",
      userAccountRequired: "This login is only for user accounts. Please use the admin login instead.",
      trustItems: [
        "Track production, imports, and exports in one place",
        "Send SLT to verified users with live balance updates",
        "Manage preferences, profile data, and account security",
      ],
    },
    fr: {
      login: "Connexion",
      signup: "S'inscrire",
      email: "Adresse email",
      password: "Mot de passe",
      confirmPassword: "Confirmer le mot de passe",
      forgotPassword: "La reinitialisation du mot de passe sera ajoutee ensuite.",
      forgotPasswordTitle: "Mot de passe oublie ?",
      forgotPasswordAction: "Reinitialiser",
      forgotPasswordHelp: "Entrez votre email et nous enverrons un lien de reinitialisation securise.",
      forgotPasswordButton: "Envoyer le lien",
      forgotPasswordSuccess: "Si cet email est enregistre, un lien de reinitialisation est en route. Verifiez votre boite mail.",
      forgotPasswordSending: "Envoi...",
      forgotPasswordTimeout: "La demande prend trop de temps. Veuillez reessayer dans un instant.",
      noAccount: "Nouveau sur SoleyVolt ?",
      hasAccount: "Vous avez deja un compte ?",
      loginButton: "Entrer dans le portail",
      signupButton: "Creer un compte",
      tagline: "Nouvo Lenerzi, Nouvo Moris.",
      headline: "Votre portefeuille energie, identite et transferts dans un portail securise.",
      subheadline:
        "Connectez-vous pour suivre la performance solaire, gerer votre solde SLT et transferer de la valeur instantanement.",
      missingConfig:
        "Ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY avant de vous connecter.",
      passwordMismatch: "Les mots de passe ne correspondent pas.",
      signupSuccess: "Compte cree. Verifiez votre email pour confirmer puis connectez-vous.",
      loginSuccess: "Connexion reussie. Bon retour.",
      loading: "Connexion...",
      backHome: "Retour a l'accueil",
      adminAccess: "Acces admin",
      secure: "Authentification Supabase securisee",
      fast: "Activite des tokens en temps reel",
      trusted: "Pense pour l'energie a Maurice",
      loginIntro: "Bon retour. Reprenez la ou votre portefeuille s'est arrete.",
      signupIntro: "Creez votre compte et activez votre portefeuille energie.",
      usageTitle: "Comment utiliserez-vous SoleyVolt ?",
      usageHelp: "Choisissez le profil qui correspond le mieux a votre usage energetique. Cela organise votre portail apres connexion.",
      switchToLogin: "Connexion",
      switchToSignup: "S'inscrire",
      trustTitle: "Dans votre portail",
      userOnlyAccess: "Acces reserve au portail utilisateur. Les comptes admin doivent passer par la connexion admin.",
      userAccountRequired: "Cette connexion est reservee aux comptes utilisateur. Utilisez plutot la connexion admin.",
      trustItems: [
        "Suivez production, importation et exportation au meme endroit",
        "Envoyez des SLT aux utilisateurs verifies avec solde en direct",
        "Gerez vos preferences, votre profil et la securite du compte",
      ],
    },
    cr: {
      login: "Konekte",
      signup: "Enskrire",
      email: "Adrès email",
      password: "Password",
      confirmPassword: "Konfirm password",
      forgotPassword: "Reset password pou vinn apre.",
      forgotPasswordTitle: "To finn bliye to password?",
      forgotPasswordAction: "Reset password",
      forgotPasswordHelp: "Met to email ek nou pou avoy enn lien reset sekirize.",
      forgotPasswordButton: "Avoy lien reset",
      forgotPasswordSuccess: "Si sa email-la existe, enn lien reset pe al dan to mailbox. Verifye to inbox.",
      forgotPasswordSending: "Pe avoye...",
      forgotPasswordTimeout: "Demann-la pe pran tro bokou letan. Reesey dan enn ti moman.",
      noAccount: "To nouvo lor SoleyVolt?",
      hasAccount: "To deza ena enn kont?",
      loginButton: "Antre dan Portal",
      signupButton: "Kree Kont",
      tagline: "Nouvo Lenerzi, Nouvo Moris.",
      headline: "To wallet lenzerzi, idantite ek transfer dan enn portal sekirize.",
      subheadline:
        "Konekte pou swiv performans soler, get to balans SLT, ek transfer valer instantaneman.",
      missingConfig:
        "Ajout VITE_SUPABASE_URL ek VITE_SUPABASE_PUBLISHABLE_KEY avan konekte.",
      passwordMismatch: "Bann password pa pe koresponn.",
      signupSuccess: "Kont inn kree. Verifye to email apre konekte.",
      loginSuccess: "Login reisi. Bon retour.",
      loading: "Pe konekte...",
      backHome: "Retour lakaz",
      adminAccess: "Aksed admin",
      secure: "Supabase auth sekirize",
      fast: "Aktivite token an real-time",
      trusted: "Fer pou rezo lenzerzi Moris",
      loginIntro: "Bon retour. Repran kot to wallet ti arrete.",
      signupIntro: "Kree to kont ek aktiv to wallet lenzerzi.",
      usageTitle: "Kouma to pou servi SoleyVolt?",
      usageHelp: "Swazir profil ki pli bien koresponn ar to fason servi lenerzi. Sa pou adapt to portal apre login.",
      switchToLogin: "Konekte",
      switchToSignup: "Enskrire",
      trustTitle: "Dan to portal",
      userOnlyAccess: "Sa login-la rezerv pou portal user. Bann admin bizin konekte depi login admin.",
      userAccountRequired: "Sa login-la zis pou bann user. Silteple servi login admin.",
      trustItems: [
        "Swiv prodiksion, import ek export dan enn sel plas",
        "Avoy SLT ar bann user verifye avek balans an direk",
        "Manage preference, profil ek sekirite kont",
      ],
    },
  } satisfies Record<
    Language,
    {
      login: string;
      signup: string;
      email: string;
      password: string;
      confirmPassword: string;
      forgotPassword: string;
      forgotPasswordTitle: string;
      forgotPasswordAction: string;
      forgotPasswordHelp: string;
      forgotPasswordButton: string;
      forgotPasswordSuccess: string;
      forgotPasswordSending: string;
      forgotPasswordTimeout: string;
      noAccount: string;
      hasAccount: string;
      loginButton: string;
      signupButton: string;
      tagline: string;
      headline: string;
      subheadline: string;
      missingConfig: string;
      passwordMismatch: string;
      signupSuccess: string;
      loginSuccess: string;
      loading: string;
      backHome: string;
      adminAccess: string;
      secure: string;
      fast: string;
      trusted: string;
      loginIntro: string;
      signupIntro: string;
      usageTitle: string;
      usageHelp: string;
      switchToLogin: string;
      switchToSignup: string;
      trustTitle: string;
      userOnlyAccess: string;
      userAccountRequired: string;
      trustItems: string[];
    }
  >;

  const currentCopy = copy[lang];

  const portalStats = [
    { icon: ShieldCheck, label: currentCopy.secure },
    { icon: Sparkles, label: currentCopy.fast },
    { icon: Wallet, label: currentCopy.trusted },
  ];
  const usageOptions = [
    {
      type: "consumer" as UserType,
      title: "Consumer",
      description: "I mainly consume electricity and want to track bills and reduce Red Coins.",
      icon: PlugZap,
    },
    {
      type: "producer" as UserType,
      title: "Producer",
      description: "I mainly export electricity and want to store Yellow Coin credits.",
      icon: Leaf,
    },
    {
      type: "prosumer" as UserType,
      title: "Prosumer",
      description: "I both consume and produce electricity and need the full portal view.",
      icon: BadgeDollarSign,
    },
  ];

  const getResetRedirectUrl = () => `${window.location.origin}/auth/reset`;

  const getErrorMessage = (err: unknown) => {
    if (err instanceof Error) {
      return err.message;
    }

    if (typeof err === "string") {
      return err;
    }

    if (err && typeof err === "object") {
      return JSON.stringify(err);
    }

    return "Unable to send reset link.";
  };

  const handleForgotPassword = async () => {
    setError("");
    setMessage("");

    if (!isConfigured || !supabase) {
      setError(currentCopy.missingConfig);
      return;
    }

    const email = forgotPasswordEmail.trim() || formData.email.trim();

    if (!email) {
      setError(currentCopy.email);
      return;
    }

    setIsSendingReset(true);

    try {
      const resetResponse = await Promise.race([
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getResetRedirectUrl(),
        }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => {
            reject(new Error(currentCopy.forgotPasswordTimeout));
          }, 15000);
        }),
      ]);

      const { error: resetError } = resetResponse;

      if (resetError) {
        throw resetError;
      }

      setForgotPasswordEmail(email);
      toast.success(currentCopy.forgotPasswordSuccess);
      setMessage(currentCopy.forgotPasswordSuccess);
    } catch (err) {
      if (err instanceof Error && /rate limit/i.test(err.message)) {
        toast.success(currentCopy.forgotPasswordSuccess);
        setMessage(currentCopy.forgotPasswordSuccess);
        return;
      }

      setError(getErrorMessage(err));
    } finally {
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

    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError(currentCopy.passwordMismatch);
      return;
    }

    setIsSubmitting(true);

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (signInError) {
          throw signInError;
        }

        const profile = await getMyProfile();

        if (!profile) {
          await supabase.auth.signOut();
          throw new Error("Profile not found for this account.");
        }

        if (profile.role !== "user") {
          await supabase.auth.signOut();
          throw new Error(currentCopy.userAccountRequired);
        }

        toast.success(currentCopy.loginSuccess);
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.email.split("@")[0],
            user_type: formData.userType,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      toast.success(currentCopy.signupSuccess);
      setMessage(currentCopy.signupSuccess);
      setIsLogin(true);
      setFormData((current) => ({ ...current, password: "", confirmPassword: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (nextIsLogin: boolean) => {
    setIsLogin(nextIsLogin);
    setError("");
    setMessage("");
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

          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">
            <Globe2 className="h-4 w-4 text-amber-300" />
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Language)}
              className="bg-transparent text-sm text-white outline-none"
            >
              <option value="en" className="text-slate-900">
                EN
              </option>
              <option value="fr" className="text-slate-900">
                FR
              </option>
              <option value="cr" className="text-slate-900">
                CR
              </option>
            </select>
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
                  <p className="text-sm text-white/65">Digital energy exchange portal</p>
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

                <div className="mb-6 flex rounded-2xl bg-slate-100 p-1.5">
                  <button
                    type="button"
                    onClick={() => switchMode(true)}
                    className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition ${
                      isLogin ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
                    }`}
                  >
                    {currentCopy.switchToLogin}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode(false)}
                    className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition ${
                      !isLogin ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
                    }`}
                  >
                    {currentCopy.switchToSignup}
                  </button>
                </div>

                <div className="mb-6">
                  <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                    {isLogin ? currentCopy.login : currentCopy.signup}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {isLogin ? currentCopy.loginIntro : currentCopy.signupIntro}
                  </p>
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
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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

                  {!isLogin ? (
                    <>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          {currentCopy.confirmPassword}
                        </label>
                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-amber-400 focus-within:ring-4 focus-within:ring-amber-100">
                          <ShieldCheck className="h-5 w-5 text-slate-400" />
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            required
                            value={formData.confirmPassword}
                            onChange={(e) =>
                              setFormData({ ...formData, confirmPassword: e.target.value })
                            }
                            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                            placeholder="Repeat your password"
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
                      <div>
                        <div className="mb-2">
                          <label className="block text-sm font-medium text-slate-700">{currentCopy.usageTitle}</label>
                          <p className="mt-1 text-sm leading-6 text-slate-500">{currentCopy.usageHelp}</p>
                        </div>
                        <div className="grid gap-3">
                          {usageOptions.map((option) => (
                            <button
                              key={option.type}
                              type="button"
                              onClick={() => setFormData({ ...formData, userType: option.type })}
                              className={`rounded-2xl border px-4 py-4 text-left transition ${
                                formData.userType === option.type
                                  ? "border-emerald-400 bg-emerald-50 shadow-sm"
                                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                                    formData.userType === option.type ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  <option.icon className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-slate-900">{option.title}</p>
                                    <span
                                      className={`h-4 w-4 rounded-full border ${
                                        formData.userType === option.type
                                          ? "border-emerald-600 bg-emerald-600"
                                          : "border-slate-300 bg-white"
                                      }`}
                                    />
                                  </div>
                                  <p className="mt-1 text-sm leading-6 text-slate-600">{option.description}</p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : null}

                  <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <span>{currentCopy.secure}</span>
                    {isLogin ? (
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword((current) => !current)}
                        className="font-medium text-amber-700 transition hover:text-amber-800"
                      >
                        {currentCopy.forgotPasswordAction}
                      </button>
                    ) : (
                      <span className="text-emerald-700">{currentCopy.fast}</span>
                    )}
                  </div>

                  {isLogin && showForgotPassword ? (
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
                        {isLogin ? currentCopy.loginButton : currentCopy.signupButton}
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-6 flex flex-col gap-4 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-600">
                    {isLogin ? currentCopy.noAccount : currentCopy.hasAccount}
                  </p>
                  <button
                    type="button"
                    onClick={() => switchMode(!isLogin)}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    {isLogin ? currentCopy.switchToSignup : currentCopy.switchToLogin}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
