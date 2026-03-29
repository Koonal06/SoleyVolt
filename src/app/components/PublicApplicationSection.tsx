import { ArrowRight, FileCheck2, ShieldCheck, UserRoundSearch } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { submitUserApplication } from "../../lib/server-api";

type Language = "en" | "fr" | "cr";

type Props = {
  language: Language;
  standalone?: boolean;
};

const copy = {
  en: {
    eyebrow: "Apply Now",
    title: "Start with a regulated application, not public signup",
    body:
      "SoleyVolt onboarding is reviewed by staff before any account is created. Submit your application and our team will validate your identity and user type before giving you portal access.",
    cardOne: "Application submitted to the protected review queue",
    cardTwo: "Staff validation before any user account is created",
    cardThree: "Approved applicants receive portal access or password setup",
    fullName: "Full name",
    nic: "NIC",
    email: "Email",
    phone: "Telephone",
    address: "Address",
    language: "Preferred language",
    applicantType: "Applicant type",
    submit: "Submit application",
    submitting: "Submitting...",
    successTitle: "Application submitted",
    successBody:
      "Your details are now in the SoleyVolt review queue. You will only receive portal access after staff approval.",
    namePlaceholder: "Applicant name",
    nicPlaceholder: "NIC / National ID",
    emailPlaceholder: "name@example.com",
    phonePlaceholder: "Telephone number",
    addressPlaceholder: "Residential or business address",
  },
  fr: {
    eyebrow: "Postuler",
    title: "Commencez par une demande reglementee, pas par une inscription publique",
    body:
      "L'onboarding SoleyVolt est verifie par l'equipe avant toute creation de compte. Soumettez votre demande et l'equipe validera votre identite et votre type d'utilisateur avant de donner l'acces au portail.",
    cardOne: "Demande envoyee vers la file de revue protegee",
    cardTwo: "Validation par l'equipe avant toute creation de compte",
    cardThree: "Les demandes approuvees recoivent l'acces ou un lien de mot de passe",
    fullName: "Nom complet",
    nic: "NIC",
    email: "Email",
    phone: "Telephone",
    address: "Adresse",
    language: "Langue preferee",
    applicantType: "Type de demandeur",
    submit: "Soumettre la demande",
    submitting: "Envoi...",
    successTitle: "Demande envoyee",
    successBody:
      "Vos informations sont maintenant dans la file de revue SoleyVolt. L'acces au portail n'est donne qu'apres approbation.",
    namePlaceholder: "Nom du demandeur",
    nicPlaceholder: "NIC / Identifiant national",
    emailPlaceholder: "nom@example.com",
    phonePlaceholder: "Numero de telephone",
    addressPlaceholder: "Adresse residentielle ou commerciale",
  },
  cr: {
    eyebrow: "Aplik Asterla",
    title: "Koumans par enn aplikasyon regile, pa enn signup piblik",
    body:
      "Onboarding SoleyVolt pas dan revizyon lekip avan okenn kont kree. Soumet to aplikasyon ek lekip pou valide to idantite ek to tip user avan donn twa aksed portal.",
    cardOne: "Aplikasyon al dan file revizyon proteze",
    cardTwo: "Validasyon lekip avan kree okenn kont",
    cardThree: "Aplikasyon aprouve gagn aksed portal ouswa setup motdepase",
    fullName: "Nom konple",
    nic: "NIC",
    email: "Email",
    phone: "Telefon",
    address: "Adres",
    language: "Lang prefere",
    applicantType: "Tip aplikant",
    submit: "Soumet aplikasyon",
    submitting: "Pe soumet...",
    successTitle: "Aplikasyon finn ale",
    successBody:
      "To detay asterla dan file revizyon SoleyVolt. To gagn aksed portal zis apre laprouvasyon.",
    namePlaceholder: "Nom aplikant",
    nicPlaceholder: "NIC / ID nasional",
    emailPlaceholder: "nom@example.com",
    phonePlaceholder: "Numero telefon",
    addressPlaceholder: "Adres lakaz ouswa biznes",
  },
} as const;

const languageOptions = [
  { value: "en", label: "English" },
  { value: "fr", label: "Francais" },
  { value: "cr", label: "Kreol" },
] as const;

const applicantTypeOptions = [
  { value: "consumer", label: "Consumer" },
  { value: "producer", label: "Producer" },
  { value: "prosumer", label: "Prosumer" },
] as const;

const initialForm = {
  full_name: "",
  nic: "",
  email: "",
  phone: "",
  address: "",
  preferred_language: "en" as Language,
  applicant_type: "prosumer" as "consumer" | "producer" | "prosumer",
  notes: "",
};

function normalizeNic(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
}

export function PublicApplicationSection({ language, standalone = false }: Props) {
  const currentCopy = copy[language];
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!/^[A-Z0-9]{14}$/.test(form.nic)) {
      toast.error("NIC must contain exactly 14 alphanumeric characters.");
      return;
    }

    try {
      setIsSubmitting(true);
      await submitUserApplication(form);
      setIsSubmitted(true);
      setForm(initialForm);
      toast.success(currentCopy.successTitle);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit application.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id={standalone ? undefined : "apply"} className={standalone ? "" : "px-4 py-18 sm:px-6 lg:px-8"}>
      <div className={`mx-auto grid gap-8 lg:grid-cols-[0.92fr_1.08fr] ${standalone ? "max-w-none" : "max-w-7xl"}`}>
        <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] p-8 backdrop-blur">
          <p className="text-sm uppercase tracking-[0.25em] text-emerald-200/80">{currentCopy.eyebrow}</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{currentCopy.title}</h2>
          <p className="mt-5 max-w-xl text-base leading-8 text-white/72">{currentCopy.body}</p>

          <div className="mt-8 space-y-4">
            {[
              { icon: FileCheck2, text: currentCopy.cardOne },
              { icon: UserRoundSearch, text: currentCopy.cardTwo },
              { icon: ShieldCheck, text: currentCopy.cardThree },
            ].map((item) => (
              <div key={item.text} className="flex items-start gap-4 rounded-[1.5rem] border border-white/10 bg-slate-950/25 px-5 py-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                  <item.icon className="h-5 w-5" />
                </div>
                <p className="text-sm leading-7 text-white/74">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.94))] p-8 text-slate-900 shadow-[0_30px_100px_rgba(0,0,0,0.24)]">
          {isSubmitted ? (
            <div className="rounded-[1.7rem] border border-emerald-200 bg-emerald-50 px-6 py-8">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">{currentCopy.successTitle}</p>
              <p className="mt-4 text-base leading-8 text-slate-700">{currentCopy.successBody}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
              <label className="block sm:col-span-1">
                <span className="mb-2 block text-sm font-medium text-slate-700">{currentCopy.fullName}</span>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
                  placeholder={currentCopy.namePlaceholder}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </label>

              <label className="block sm:col-span-1">
                <span className="mb-2 block text-sm font-medium text-slate-700">{currentCopy.nic}</span>
                <input
                  type="text"
                  required
                  value={form.nic}
                  onChange={(event) => setForm((current) => ({ ...current, nic: normalizeNic(event.target.value) }))}
                  placeholder={currentCopy.nicPlaceholder}
                  inputMode="text"
                  maxLength={14}
                  pattern="[A-Za-z0-9]{14}"
                  title="NIC must contain exactly 14 alphanumeric characters."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm uppercase outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </label>

              <label className="block sm:col-span-1">
                <span className="mb-2 block text-sm font-medium text-slate-700">{currentCopy.email}</span>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder={currentCopy.emailPlaceholder}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </label>

              <label className="block sm:col-span-1">
                <span className="mb-2 block text-sm font-medium text-slate-700">{currentCopy.phone}</span>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder={currentCopy.phonePlaceholder}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">{currentCopy.address}</span>
                <textarea
                  required
                  rows={3}
                  value={form.address}
                  onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                  placeholder={currentCopy.addressPlaceholder}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </label>

              <label className="block sm:col-span-1">
                <span className="mb-2 block text-sm font-medium text-slate-700">{currentCopy.language}</span>
                <select
                  value={form.preferred_language}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, preferred_language: event.target.value as Language }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                >
                  {languageOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block sm:col-span-1">
                <span className="mb-2 block text-sm font-medium text-slate-700">{currentCopy.applicantType}</span>
                <select
                  value={form.applicant_type}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      applicant_type: event.target.value as "consumer" | "producer" | "prosumer",
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                >
                  {applicantTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#10b981,#22c55e,#f2b61f)] px-6 py-4 text-sm font-semibold text-slate-950 shadow-[0_18px_40px_rgba(16,185,129,0.25)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? currentCopy.submitting : currentCopy.submit}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
