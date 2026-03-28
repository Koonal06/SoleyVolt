import { ArrowLeft, Globe2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { BrandLogo } from "../components/BrandLogo";
import { PublicApplicationSection } from "../components/PublicApplicationSection";
import { getStoredLanguage, setStoredLanguage } from "../lib/language";

type Language = "en" | "fr" | "cr";

const copy = {
  en: {
    backHome: "Back to home",
    userLogin: "User Login",
    adminLogin: "Admin Login",
    portal: "Application Portal",
    intro:
      "Submit your onboarding request through this controlled channel. SoleyVolt staff review every application before any portal account is activated.",
  },
  fr: {
    backHome: "Retour a l'accueil",
    userLogin: "Connexion utilisateur",
    adminLogin: "Connexion admin",
    portal: "Portail de demande",
    intro:
      "Soumettez votre demande via ce parcours controle. L'equipe SoleyVolt examine chaque dossier avant d'activer un compte portail.",
  },
  cr: {
    backHome: "Retour lakaz",
    userLogin: "Login user",
    adminLogin: "Login admin",
    portal: "Portal aplikasyon",
    intro:
      "Soumet to demann atraver sa channel kontrol-la. Lekip SoleyVolt reviz sak aplikasyon avan okenn kont portal vinn aktif.",
  },
} as const;

export function ApplyNowPage() {
  const [language, setLanguage] = useState<Language>(() => getStoredLanguage());
  const currentCopy = copy[language];

  useEffect(() => {
    setStoredLanguage(language);
  }, [language]);

  return (
    <div className="min-h-screen bg-[#07142b] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.14),_transparent_28%),linear-gradient(135deg,_#07142b_10%,_#0b2b57_48%,_#052f2a_100%)]" />
      <div className="relative mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/90 transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            {currentCopy.backHome}
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">
              <Globe2 className="h-4 w-4 text-amber-300" />
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
                className="bg-transparent text-sm text-white outline-none"
              >
                <option value="en" className="text-slate-900">EN</option>
                <option value="fr" className="text-slate-900">FR</option>
                <option value="cr" className="text-slate-900">CR</option>
              </select>
            </div>
            <Link
              to="/login"
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/90 transition hover:bg-white/10"
            >
              {currentCopy.userLogin}
            </Link>
            <Link
              to="/admin/login"
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/90 transition hover:bg-white/10"
            >
              {currentCopy.adminLogin}
            </Link>
          </div>
        </div>

        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden">
            <BrandLogo className="h-full w-full object-contain" />
          </div>
          <div>
            <p className="text-2xl font-semibold tracking-tight">SoleyVolt</p>
            <p className="text-sm text-white/65">{currentCopy.portal}</p>
          </div>
        </div>

        <div className="mb-8 max-w-3xl">
          <p className="text-lg leading-8 text-white/72">{currentCopy.intro}</p>
        </div>

        <PublicApplicationSection language={language} standalone />
      </div>
    </div>
  );
}
