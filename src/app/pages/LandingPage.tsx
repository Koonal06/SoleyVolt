import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  Globe2,
  Shield,
  SunMedium,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { useGreenCoinMarket } from "../../lib/green-coin-market";
import { BrandLogo } from "../components/BrandLogo";
import { getStoredLanguage, setStoredLanguage } from "../lib/language";

type Language = "en" | "fr" | "cr";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatUpdatedTime(value: string | null | undefined) {
  if (!value) {
    return "Awaiting sync";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

export function LandingPage() {
  const [lang, setLang] = useState<Language>(() => getStoredLanguage());
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const { basePrice, livePrice, changePercent, phaseLabel, clockLabel, settings, isLoading: isLoadingMarket, source } = useGreenCoinMarket();

  useEffect(() => {
    setStoredLanguage(lang);
  }, [lang]);

  const copy = {
    en: {
      tagline: "Nouvo Lenerzi, Nouvo Moris.",
      heroTitle: "A modern energy exchange for solar households, communities, and Mauritius.",
      heroDesc:
        "Convert clean power into living value. SoleyVolt turns solar production into secure digital balances you can track, store, and transfer in real time.",
      getStarted: "User Login",
      login: "Login",
      home: "Home",
      about: "Vision",
      features: "Platform",
      faq: "FAQ",
      contact: "Contact",
      statsTitle: "Built for a live energy economy",
      aboutTitle: "Powering Mauritius with a more fluid energy system",
      aboutText:
        "SoleyVolt gives solar value a digital layer. We connect production, wallet balances, user transfers, and secure identity into one platform designed for a cleaner, more connected island energy market.",
      featuresTitle: "What the platform unlocks",
      howItWorksTitle: "How SoleyVolt flows",
      faqTitle: "Questions people ask first",
      contactTitle: "Talk to the SoleyVolt team",
      contactDesc:
        "Planning a launch, pilot, or energy-credit workflow? Share a few details and we will help shape the right setup.",
      formButton: "Send Inquiry",
      metricUsers: "Active wallets",
      metricVolume: "Monthly token volume",
      metricSync: "Realtime sync",
      metricSecurity: "Secure auth layer",
      badge: "Digital Energy Exchange",
      ctaTitle: "Bring your solar output into a trusted transaction layer.",
      ctaBody: "Log in with your assigned credentials and access your wallet and energy activity through a secure portal.",
      heroEyebrow: "Built for secure energy value exchange",
      heroPanelTitle: "Live network pulse",
      heroPanelNote: "Production, transfers, and identity flow through one trusted layer.",
      heroSignalsTitle: "Realtime network signals",
      visionPillOne: "Realtime wallet activity",
      visionPillTwo: "Solar-to-token translation",
      visionPillThree: "Transfer-ready user accounts",
      proofTitle: "Why the model feels operational, not conceptual",
      proofLead:
        "SoleyVolt is designed to feel like infrastructure from the first interaction: measured, legible, and ready for pilot programs or live community energy workflows.",
      proofCardOneTitle: "Visible energy economics",
      proofCardOneBody: "Production, import, export, and token movement stay understandable across the whole platform.",
      proofCardTwoTitle: "Platform-level trust design",
      proofCardTwoBody: "Identity, wallet balances, and permissioned access are shaped into one consistent system.",
      proofCardThreeTitle: "Mauritius-ready exchange flow",
      proofCardThreeBody: "The experience is tuned for local pilots, community rollouts, and broader renewable participation.",
      explorePlatform: "Explore Platform",
      energyWallet: "Energy Wallet",
      exported: "Exported",
      imported: "Imported",
      realtimeActivityTitle: "Realtime activity",
      realtimeActivityBody: "Updated across dashboards and wallets",
      activityOne: "+120 SLT solar credit",
      activityTwo: "-30 SLT peer transfer",
      activityThree: "+45 SLT received",
      platformSignalsTitle: "Platform Signals",
      active: "Active",
      signalOne: "Secure auth and user access",
      signalTwo: "Wallet-first transfer system",
      signalThree: "Data model ready for energy records",
      aboutOne: "Realtime energy and wallet state",
      aboutTwo: "Identity, security, and wallet access in one flow",
      aboutThree: "Designed to scale from pilots to wider exchange models",
      featuresLead:
        "SoleyVolt is shaped to feel useful on day one: measurable energy, readable balances, and guided exchange between verified participants.",
      featureOneTitle: "Track live production",
      featureOneDesc: "See imports, exports, and wallet movement through one energy-aware dashboard.",
      featureTwoTitle: "Convert output to value",
      featureTwoDesc: "Map solar performance into tokenized balances ready for credits and transfers.",
      featureThreeTitle: "Transfer between users",
      featureThreeDesc: "Move SLT between verified users with a clear, wallet-first experience.",
      featureFourTitle: "Stay secure by design",
      featureFourDesc: "Use authenticated access, realtime data sync, and a stronger operational foundation.",
      flowLabel: "Flow",
      stepOneTitle: "Capture energy signals",
      stepOneDesc: "Meter or production data enters the system as clear import and export activity.",
      stepTwoTitle: "Translate into balances",
      stepTwoDesc: "SoleyVolt transforms validated energy movement into SLT wallet value.",
      stepThreeTitle: "Store and monitor",
      stepThreeDesc: "Users view balances, profile settings, and recent activity in one portal.",
      stepFourTitle: "Exchange confidently",
      stepFourDesc: "Transfer value across the network with a consistent and auditable flow.",
      faqOneQ: "What are SoleyVolt tokens?",
      faqOneA: "They represent tracked energy value inside the platform and are designed to move through wallets, credits, and transfers clearly.",
      faqTwoQ: "Who is the platform for?",
      faqTwoA: "Solar households, pilot communities, operators, and energy programs that want a clearer digital layer for renewable value exchange.",
      faqThreeQ: "Can users transfer tokens to one another?",
      faqThreeA: "Yes. The product is designed around wallet balances and peer transfers between registered users.",
      faqFourQ: "Is the platform secure?",
      faqFourA: "Yes. SoleyVolt uses authenticated access, secure backend services, and a realtime data foundation built around Supabase.",
      faqFiveQ: "How do I get started?",
      faqFiveA: "Request internal onboarding from the SoleyVolt team, receive your credentials, then sign in to your assigned portal.",
      contactOne: "Pilot-friendly onboarding path",
      contactTwo: "Wallet, transfer, and dashboard workflow guidance",
      contactThree: "Support for participant setup",
      nameLabel: "Name",
      emailLabel: "Email",
      messageLabel: "Message",
      getStartedLabel: "Get Started",
      footerCopy: "© 2026 SoleyVolt. Mauritius energy, digitally connected.",
      contactSuccess: "Your message has been sent. We will get back to you soon.",
      contactError: "We could not send your message right now. Please try again.",
      contactSending: "Sending...",
    },
    fr: {
      tagline: "Nouvo Lenerzi, Nouvo Moris.",
      heroTitle: "Un echange moderne d'energie pour les foyers solaires, les communautes et Maurice.",
      heroDesc:
        "Transformez l'energie propre en valeur utile. SoleyVolt convertit la production solaire en soldes numeriques securises, suivis et transferables en temps reel.",
      getStarted: "Connexion utilisateur",
      login: "Connexion",
      home: "Accueil",
      about: "Vision",
      features: "Plateforme",
      faq: "FAQ",
      contact: "Contact",
      statsTitle: "Concu pour une economie energetique vivante",
      aboutTitle: "Alimenter Maurice avec un systeme energetique plus fluide",
      aboutText:
        "SoleyVolt ajoute une couche numerique a la valeur solaire. Nous relions production, portefeuille, transferts entre utilisateurs et identite securisee sur une seule plateforme.",
      featuresTitle: "Ce que la plateforme rend possible",
      howItWorksTitle: "Comment SoleyVolt circule",
      faqTitle: "Les premieres questions",
      contactTitle: "Parlez avec l'equipe SoleyVolt",
      contactDesc:
        "Vous preparez un lancement, un pilote ou un flux de credits energie ? Partagez votre besoin et nous vous aiderons a cadrer la bonne configuration.",
      formButton: "Envoyer la demande",
      metricUsers: "Portefeuilles actifs",
      metricVolume: "Volume mensuel de tokens",
      metricSync: "Synchronisation temps reel",
      metricSecurity: "Couche d'authentification securisee",
      badge: "Echange Numerique d'Energie",
      ctaTitle: "Faites entrer votre production solaire dans une couche transactionnelle fiable.",
      ctaBody: "Connectez-vous avec vos identifiants attribues pour acceder a votre portefeuille et a votre activite energie dans un portail securise.",
      heroEyebrow: "Concu pour un echange de valeur energetique securise",
      heroPanelTitle: "Pulse du reseau en direct",
      heroPanelNote: "Production, transferts et identite circulent dans une seule couche fiable.",
      heroSignalsTitle: "Signaux reseau en temps reel",
      visionPillOne: "Activite portefeuille en direct",
      visionPillTwo: "Conversion solaire vers token",
      visionPillThree: "Comptes utilisateurs prets au transfert",
      proofTitle: "Pourquoi le modele parait operationnel, pas theorique",
      proofLead:
        "SoleyVolt est pense comme une infrastructure des la premiere interaction : lisible, maitrisee et prete pour des pilotes ou des flux energie communautaires.",
      proofCardOneTitle: "Economie energetique visible",
      proofCardOneBody: "Production, importation, exportation et mouvement des tokens restent clairs sur toute la plateforme.",
      proofCardTwoTitle: "Confiance integree au niveau plateforme",
      proofCardTwoBody: "Identite, soldes portefeuille et acces controles forment un systeme coherent.",
      proofCardThreeTitle: "Flux adapte a Maurice",
      proofCardThreeBody: "L'experience est ajustee pour des pilotes locaux, des deployments communautaires et une participation renouvelable plus large.",
      explorePlatform: "Explorer la plateforme",
      energyWallet: "Portefeuille energie",
      exported: "Exporte",
      imported: "Importe",
      realtimeActivityTitle: "Activite en temps reel",
      realtimeActivityBody: "Mise a jour sur les tableaux de bord et portefeuilles",
      activityOne: "+120 SLT credit solaire",
      activityTwo: "-30 SLT transfert pair a pair",
      activityThree: "+45 SLT recus",
      platformSignalsTitle: "Signaux plateforme",
      active: "Actif",
      signalOne: "Authentification securisee et acces utilisateur",
      signalTwo: "Systeme de transfert centre sur le portefeuille",
      signalThree: "Modele de donnees pret pour les releves energie",
      aboutOne: "Etat energie et portefeuille en temps reel",
      aboutTwo: "Identite, securite et acces portefeuille dans un seul flux",
      aboutThree: "Concu pour evoluer des pilotes vers des modeles plus larges",
      featuresLead:
        "SoleyVolt est pense pour etre utile des le premier jour : energie mesurable, soldes lisibles et echange guide entre participants verifies.",
      featureOneTitle: "Suivre la production en direct",
      featureOneDesc: "Visualisez imports, exports et mouvements du portefeuille sur un seul tableau de bord.",
      featureTwoTitle: "Convertir la production en valeur",
      featureTwoDesc: "Transformez la performance solaire en soldes tokenises prets pour credits et transferts.",
      featureThreeTitle: "Transferer entre utilisateurs",
      featureThreeDesc: "Envoyez des SLT entre utilisateurs verifies avec une experience claire et centree sur le portefeuille.",
      featureFourTitle: "Securise des la conception",
      featureFourDesc: "Utilisez une authentification protegee, une synchro temps reel et une base operationnelle plus solide.",
      flowLabel: "Flux",
      stepOneTitle: "Capturer les signaux energie",
      stepOneDesc: "Les donnees de compteur ou de production entrent comme activite claire d'import et d'export.",
      stepTwoTitle: "Traduire en soldes",
      stepTwoDesc: "SoleyVolt transforme les mouvements energie valides en valeur SLT dans le portefeuille.",
      stepThreeTitle: "Stocker et surveiller",
      stepThreeDesc: "Les utilisateurs consultent soldes, reglages et activite recente dans un meme portail.",
      stepFourTitle: "Echanger avec confiance",
      stepFourDesc: "Transferer de la valeur sur le reseau avec un flux coherent et verifiable.",
      faqOneQ: "Que sont les tokens SoleyVolt ?",
      faqOneA: "Ils representent une valeur energie suivie dans la plateforme et circulent clairement entre portefeuilles, credits et transferts.",
      faqTwoQ: "A qui s'adresse la plateforme ?",
      faqTwoA: "Aux foyers solaires, pilotes communautaires, operateurs et programmes energie qui veulent une couche numerique plus claire.",
      faqThreeQ: "Les utilisateurs peuvent-ils se transferer des tokens ?",
      faqThreeA: "Oui. Le produit est concu autour des soldes portefeuille et des transferts entre utilisateurs enregistres.",
      faqFourQ: "La plateforme est-elle securisee ?",
      faqFourA: "Oui. SoleyVolt utilise une authentification securisee, des services backend proteges et une base temps reel construite avec Supabase.",
      faqFiveQ: "Comment commencer ?",
      faqFiveA: "Demandez un onboarding interne a l'equipe SoleyVolt, recevez vos identifiants puis connectez-vous a votre portail attribue.",
      contactOne: "Parcours d'onboarding adapte aux pilotes",
      contactTwo: "Guidage sur portefeuille, transferts et tableaux de bord",
      contactThree: "Support pour la mise en place des participants",
      nameLabel: "Nom",
      emailLabel: "Email",
      messageLabel: "Message",
      getStartedLabel: "Commencer",
      footerCopy: "© 2026 SoleyVolt. Energie mauricienne, connectee numeriquement.",
      contactSuccess: "Votre message a bien ete envoye. Nous vous recontacterons bientot.",
      contactError: "Nous n'avons pas pu envoyer votre message pour le moment. Veuillez reessayer.",
      contactSending: "Envoi...",
    },
    cr: {
      tagline: "Nouvo Lenerzi, Nouvo Moris.",
      heroTitle: "Enn platform lenzerzi modern pou lakaz soler, kominote, ek Moris.",
      heroDesc:
        "Transforme lenerzi prop an valer ki bouze. SoleyVolt convertir prodiksion soler an balans digital sekirize ki to kapav swiv, garde ek transfer an direk.",
      getStarted: "Login user",
      login: "Konekte",
      home: "Lakaz",
      about: "Vizyon",
      features: "Platform",
      faq: "FAQ",
      contact: "Kontak",
      statsTitle: "Fer pou enn lekonomi lenzerzi vivan",
      aboutTitle: "Donn Moris enn sistem lenzerzi plis fluid",
      aboutText:
        "SoleyVolt pe azout enn kouch digital ar valer soler. Nou relie prodiksion, wallet, transfer ant user ek idantite sekirize dan enn sel platform.",
      featuresTitle: "Ki platform la fer posib",
      howItWorksTitle: "Kouma SoleyVolt sirkile",
      faqTitle: "Kestion ki dimoun demande avan",
      contactTitle: "Koze ar lekip SoleyVolt",
      contactDesc:
        "Si to pe prepar enn lansman, pilot ouswa workflow kredi lenzerzi, anvoy detay ek nou pou ed twa poz bon setup.",
      formButton: "Avoy Demann",
      metricUsers: "Wallet aktif",
      metricVolume: "Volim token par mwa",
      metricSync: "Sync an real-time",
      metricSecurity: "Layer auth sekirize",
      badge: "Digital Energy Exchange",
      ctaTitle: "Fer to prodiksion soler rant dan enn layer tranzaksion ki dimoun krwar ladan.",
      ctaBody: "Konekte avek credential ki finn atribie pou rant dan enn portal sekirize pou to wallet ek aktivite lenerzi.",
      heroEyebrow: "Fer pou enn echange valer lenzerzi ki sekirize",
      heroPanelTitle: "Puls rezo an direk",
      heroPanelNote: "Prodiksion, transfer ek idantite pase dan enn sel layer ki dimoun krwar ladan.",
      heroSignalsTitle: "Signal rezo an real-time",
      visionPillOne: "Aktivite wallet an direk",
      visionPillTwo: "Tradiksion soler ver token",
      visionPillThree: "Kont user pare pou transfer",
      proofTitle: "Kifer model-la paret operasyonel, pa zis enn lide",
      proofLead:
        "SoleyVolt inn krwar kouma enn lenerfrastriktir depi premie klik: kler, bien organize, ek pare pou pilot ouswa workflow lenzerzi kominoter.",
      proofCardOneTitle: "Lekonomi lenzerzi vizib",
      proofCardOneBody: "Prodiksion, import, export ek mouvman token reste fasil pou konpran lor platform-la.",
      proofCardTwoTitle: "Konfians entegre dan platform",
      proofCardTwoBody: "Idantite, balans wallet ek akses kontrol dan enn sel sistem ki koeran.",
      proofCardThreeTitle: "Workflow adapte pou Moris",
      proofCardThreeBody: "Lexperyans inn adapte pou pilot lokal, rollout kominoter ek plis partisipasion dan lenerzi renouvlab.",
      explorePlatform: "Eksplor Platform",
      energyWallet: "Wallet Lenerzi",
      exported: "Exporte",
      imported: "Importe",
      realtimeActivityTitle: "Aktivite an real-time",
      realtimeActivityBody: "Mizazour lor dashboard ek wallet",
      activityOne: "+120 SLT kredi soler",
      activityTwo: "-30 SLT transfer ant dimoun",
      activityThree: "+45 SLT resevwar",
      platformSignalsTitle: "Signal platform",
      active: "Aktif",
      signalOne: "Auth sekirize ek akses user",
      signalTwo: "Sistem transfer santre lor wallet",
      signalThree: "Model done pare pou bann reading lenerzi",
      aboutOne: "Leta lenerzi ek wallet an direk",
      aboutTwo: "Idantite, sekirite ek akses wallet dan enn sel workflow",
      aboutThree: "Fer pou grandi depi pilot ziska model pli gran",
      featuresLead:
        "SoleyVolt inn forme pou itil depi zour enn: lenerzi mezirab, balans fasil pou lir, ek echange gide ant bann partisipan verifye.",
      featureOneTitle: "Swiv prodiksion an direk",
      featureOneDesc: "Get import, export ek mouvman wallet dan enn sel dashboard lenerzi.",
      featureTwoTitle: "Konverti prodiksion an valer",
      featureTwoDesc: "Transform performans soler an balans tokenize pare pou kredi ek transfer.",
      featureThreeTitle: "Transfer ant bann user",
      featureThreeDesc: "Bouz SLT ant bann user verifye avek enn lexperyans kler ki santre lor wallet.",
      featureFourTitle: "Sekirite depi konsepsyon",
      featureFourDesc: "Servi auth proteze, sync an real-time, ek enn baz operasyonel pli solid.",
      flowLabel: "Flow",
      stepOneTitle: "Kaptir signal lenerzi",
      stepOneDesc: "Done meter ouswa prodiksion rant dan sistem kouma aktivite import ek export bien kler.",
      stepTwoTitle: "Tradir an balans",
      stepTwoDesc: "SoleyVolt transform mouvman lenerzi valide an valer SLT dan wallet.",
      stepThreeTitle: "Stoke ek siveye",
      stepThreeDesc: "Bann user trouv balans, setting profil ek aktivite resan dan enn sel portal.",
      stepFourTitle: "Echange avek konfians",
      stepFourDesc: "Transfer valer atraver rezo avek enn workflow koeran ek ki kapav verifye.",
      faqOneQ: "Ki ete token SoleyVolt?",
      faqOneA: "Zot reprezant valer lenerzi ki finn swiv dan platform ek zot sirkile kler ant wallet, kredi ek transfer.",
      faqTwoQ: "Pou kisannla sa platform-la?",
      faqTwoA: "Pou lakaz soler, pilot kominoter, operator ek program lenerzi ki anvi enn kouch digital pli kler pou echange valer renouvlab.",
      faqThreeQ: "Eski bann user kapav transfer token ant zot?",
      faqThreeA: "Wi. Produit-la inn konsevwar otour balans wallet ek transfer ant bann user anrezistre.",
      faqFourQ: "Eski platform-la sekirize?",
      faqFourA: "Wi. SoleyVolt servi auth sekirize, servis backend proteze, ek enn fondasion real-time ki baze lor Supabase.",
      faqFiveQ: "Kouma mo koumanse?",
      faqFiveA: "Demann onboarding interne ar lekip SoleyVolt, resevwar to credential, apre konekte dan portal ki finn atribie pou twa.",
      contactOne: "Parcours onboarding adapte pou pilot",
      contactTwo: "Led lor workflow wallet, transfer ek dashboard",
      contactThree: "Sipor pou setup partisipan",
      nameLabel: "Nom",
      emailLabel: "Email",
      messageLabel: "Mesaz",
      getStartedLabel: "Koumanse",
      footerCopy: "© 2026 SoleyVolt. Lenerzi Moris, konekte an digital.",
      contactSuccess: "To mesaz inn bien ale. Nou pou revin ver twa biento.",
      contactError: "Nou pa finn kapav avoy to mesaz la pou le moman. Reesey apre.",
      contactSending: "Pe avoye...",
    },
  } satisfies Record<
    Language,
    {
      tagline: string;
      heroTitle: string;
      heroDesc: string;
      getStarted: string;
      login: string;
      home: string;
      about: string;
      features: string;
      faq: string;
      contact: string;
      statsTitle: string;
      aboutTitle: string;
      aboutText: string;
      featuresTitle: string;
      howItWorksTitle: string;
      faqTitle: string;
      contactTitle: string;
      contactDesc: string;
      formButton: string;
      metricUsers: string;
      metricVolume: string;
      metricSync: string;
      metricSecurity: string;
      badge: string;
      ctaTitle: string;
      ctaBody: string;
      heroEyebrow: string;
      heroPanelTitle: string;
      heroPanelNote: string;
      heroSignalsTitle: string;
      visionPillOne: string;
      visionPillTwo: string;
      visionPillThree: string;
      proofTitle: string;
      proofLead: string;
      proofCardOneTitle: string;
      proofCardOneBody: string;
      proofCardTwoTitle: string;
      proofCardTwoBody: string;
      proofCardThreeTitle: string;
      proofCardThreeBody: string;
      explorePlatform: string;
      energyWallet: string;
      exported: string;
      imported: string;
      realtimeActivityTitle: string;
      realtimeActivityBody: string;
      activityOne: string;
      activityTwo: string;
      activityThree: string;
      platformSignalsTitle: string;
      active: string;
      signalOne: string;
      signalTwo: string;
      signalThree: string;
      aboutOne: string;
      aboutTwo: string;
      aboutThree: string;
      featuresLead: string;
      featureOneTitle: string;
      featureOneDesc: string;
      featureTwoTitle: string;
      featureTwoDesc: string;
      featureThreeTitle: string;
      featureThreeDesc: string;
      featureFourTitle: string;
      featureFourDesc: string;
      flowLabel: string;
      stepOneTitle: string;
      stepOneDesc: string;
      stepTwoTitle: string;
      stepTwoDesc: string;
      stepThreeTitle: string;
      stepThreeDesc: string;
      stepFourTitle: string;
      stepFourDesc: string;
      faqOneQ: string;
      faqOneA: string;
      faqTwoQ: string;
      faqTwoA: string;
      faqThreeQ: string;
      faqThreeA: string;
      faqFourQ: string;
      faqFourA: string;
      faqFiveQ: string;
      faqFiveA: string;
      contactOne: string;
      contactTwo: string;
      contactThree: string;
      nameLabel: string;
      emailLabel: string;
      messageLabel: string;
      getStartedLabel: string;
      footerCopy: string;
      contactSuccess: string;
      contactError: string;
      contactSending: string;
    }
  >;

  const currentCopy = copy[lang];
  const applyNowLabel = lang === "fr" ? "Postuler" : lang === "cr" ? "Aplik Asterla" : "Apply Now";
  const marketCopy = {
    en: {
      metricLabel: "Green Coin live price",
      marketTitle: "Green Coin market",
      marketBody: "The public quote tracks Mauritius demand in real time.",
      baseLabel: "Reference price",
      clockLabel: "Mauritius clock",
      trendLabel: "Live move",
      signalPrice: "Green Coin",
      signalPhase: "Market phase",
      signalDelta: "Shift vs base",
      syncLabel: "Live sync",
      fallbackLabel: "Public sync",
      updatedLabel: "Last synced",
    },
    fr: {
      metricLabel: "Prix direct Green Coin",
      marketTitle: "Marche Green Coin",
      marketBody: "Le prix public suit la demande mauricienne en direct.",
      baseLabel: "Prix de reference",
      clockLabel: "Heure Maurice",
      trendLabel: "Variation directe",
      signalPrice: "Green Coin",
      signalPhase: "Phase du marche",
      signalDelta: "Ecart vs base",
      syncLabel: "Synchro en direct",
      fallbackLabel: "Sync public",
      updatedLabel: "Derniere synchro",
    },
    cr: {
      metricLabel: "Pri Green Coin live",
      marketTitle: "Marse Green Coin",
      marketBody: "Pri piblik swiv demann Moris an direk.",
      baseLabel: "Pri referans",
      clockLabel: "Ler Moris",
      trendLabel: "Mouvman live",
      signalPrice: "Green Coin",
      signalPhase: "Faz marse",
      signalDelta: "Sanzman lor baz",
      syncLabel: "Sync live",
      fallbackLabel: "Sync piblik",
      updatedLabel: "Dernie sync",
    },
  }[lang];

  const features = [
    {
      icon: TrendingUp,
      title: currentCopy.featureOneTitle,
      desc: currentCopy.featureOneDesc,
    },
    {
      icon: Zap,
      title: currentCopy.featureTwoTitle,
      desc: currentCopy.featureTwoDesc,
    },
    {
      icon: Users,
      title: currentCopy.featureThreeTitle,
      desc: currentCopy.featureThreeDesc,
    },
    {
      icon: Shield,
      title: currentCopy.featureFourTitle,
      desc: currentCopy.featureFourDesc,
    },
  ];

  const steps = [
    {
      num: "01",
      title: currentCopy.stepOneTitle,
      desc: currentCopy.stepOneDesc,
    },
    {
      num: "02",
      title: currentCopy.stepTwoTitle,
      desc: currentCopy.stepTwoDesc,
    },
    {
      num: "03",
      title: currentCopy.stepThreeTitle,
      desc: currentCopy.stepThreeDesc,
    },
    {
      num: "04",
      title: currentCopy.stepFourTitle,
      desc: currentCopy.stepFourDesc,
    },
  ];

  const faqs = [
    {
      q: currentCopy.faqOneQ,
      a: currentCopy.faqOneA,
    },
    {
      q: currentCopy.faqTwoQ,
      a: currentCopy.faqTwoA,
    },
    {
      q: currentCopy.faqThreeQ,
      a: currentCopy.faqThreeA,
    },
    {
      q: currentCopy.faqFourQ,
      a: currentCopy.faqFourA,
    },
    {
      q: currentCopy.faqFiveQ,
      a: currentCopy.faqFiveA,
    },
  ];

  const metrics = [
    { value: `${formatCurrency(livePrice)} MUR`, label: marketCopy.metricLabel },
    { value: "12.8K", label: currentCopy.metricUsers },
    { value: "< 1s", label: currentCopy.metricSync },
    { value: "24/7", label: currentCopy.metricSecurity },
  ];

  const heroSignals = [
    { label: marketCopy.signalPrice, value: `${formatCurrency(livePrice)} MUR`, tone: "text-emerald-300" },
    { label: marketCopy.signalPhase, value: phaseLabel, tone: "text-amber-300" },
    { label: marketCopy.signalDelta, value: formatSignedPercent(changePercent), tone: "text-cyan-300" },
  ];
  const marketSyncLabel = source === "supabase" ? marketCopy.syncLabel : marketCopy.fallbackLabel;

  const proofCards = [
    {
      icon: Activity,
      title: currentCopy.proofCardOneTitle,
      body: currentCopy.proofCardOneBody,
    },
    {
      icon: Shield,
      title: currentCopy.proofCardTwoTitle,
      body: currentCopy.proofCardTwoBody,
    },
    {
      icon: SunMedium,
      title: currentCopy.proofCardThreeTitle,
      body: currentCopy.proofCardThreeBody,
    },
  ];

  const handleContactSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmittingContact) {
      return;
    }

    setIsSubmittingContact(true);

    try {
      const response = await fetch("https://formspree.io/f/mojpqpjr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          message: formData.message,
        }),
      });

      if (!response.ok) {
        throw new Error("Form submission failed");
      }

      toast.success(currentCopy.contactSuccess);
      setFormData({ name: "", email: "", message: "" });
    } catch {
      toast.error(currentCopy.contactError);
    } finally {
      setIsSubmittingContact(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#07142b] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_26%),radial-gradient(circle_at_80%_20%,_rgba(16,185,129,0.14),_transparent_24%),linear-gradient(180deg,_#061226_0%,_#09254b_48%,_#071b34_100%)]" />
      <div className="fixed inset-y-0 left-[-6%] -z-10 w-80 rotate-12 bg-white/5 blur-3xl" />
      <div className="fixed inset-y-0 right-[-8%] -z-10 w-96 -rotate-12 bg-amber-300/10 blur-3xl" />

      <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/45 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden">
              <BrandLogo className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">SoleyVolt</p>
              <p className="text-xs text-white/55">{currentCopy.badge}</p>
            </div>
          </div>

          <div className="hidden items-center gap-7 text-sm text-white/70 lg:flex">
            <a href="#home" className="transition hover:text-white">
              {currentCopy.home}
            </a>
            <a href="#about" className="transition hover:text-white">
              {currentCopy.about}
            </a>
            <a href="#features" className="transition hover:text-white">
              {currentCopy.features}
            </a>
            <a href="#faq" className="transition hover:text-white">
              {currentCopy.faq}
            </a>
            <Link to="/apply" className="transition hover:text-white">
              {applyNowLabel}
            </Link>
            <a href="#contact" className="transition hover:text-white">
              {currentCopy.contact}
            </a>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 sm:flex">
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
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#f2b61f,#f59e0b,#1f8f74)] px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_40px_rgba(245,158,11,0.26)] transition hover:brightness-105"
            >
              {currentCopy.getStarted}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/apply"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              {applyNowLabel}
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <section id="home" className="px-4 pb-20 pt-14 sm:px-6 lg:px-8 lg:pt-20">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-sm text-amber-100">
                <BrandLogo className="h-4 w-4 object-contain" />
                {currentCopy.badge}
              </div>

              <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-tight text-white sm:text-6xl">
                {currentCopy.heroTitle}
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/72">{currentCopy.heroDesc}</p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link
                  to="/apply"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#10b981,#22c55e,#f2b61f)] px-6 py-4 text-sm font-semibold text-slate-950 shadow-[0_18px_40px_rgba(16,185,129,0.24)] transition hover:brightness-105"
                >
                  {applyNowLabel}
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-white/6 px-6 py-4 text-sm font-medium text-white/90 backdrop-blur transition hover:bg-white/10"
                >
                  {currentCopy.explorePlatform}
                  <ChevronDown className="h-5 w-5" />
                </a>
              </div>

              <div className="mt-6 max-w-2xl">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    currentCopy.heroEyebrow,
                    currentCopy.visionPillOne,
                    currentCopy.visionPillTwo,
                    currentCopy.visionPillThree,
                  ].map((item, index) => (
                    <div
                      key={item}
                      className="flex min-h-14 w-full items-center gap-2 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] px-4 py-3 text-sm text-white/76 backdrop-blur"
                    >
                      {index === 0 ? (
                        <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-300" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                      )}
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] px-5 py-5 shadow-[0_25px_60px_rgba(0,0,0,0.18)] backdrop-blur"
                  >
                    <p className="text-2xl font-semibold tracking-tight text-white">{metric.value}</p>
                    <p className="mt-2 text-sm text-white/62">{metric.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-8 top-8 hidden h-28 w-28 rounded-full bg-amber-300/20 blur-3xl sm:block" />
              <div className="absolute bottom-0 right-0 hidden h-36 w-36 rounded-full bg-emerald-300/15 blur-3xl sm:block" />
              <div className="absolute right-8 top-[-1.5rem] hidden rounded-full border border-emerald-200/20 bg-emerald-300/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-emerald-100/90 sm:inline-flex">
                {currentCopy.heroPanelTitle}
              </div>

              <div className="rounded-[2rem] border border-white/12 bg-white/[0.08] p-4 shadow-[0_35px_120px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
                <div className="grid gap-4 rounded-[1.7rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.94))] p-5 text-slate-900 sm:p-6">
                  <div className="items-start gap-4 sm:grid sm:grid-cols-[1.1fr_0.9fr]">
                    <div className="self-start rounded-[1.5rem] bg-[linear-gradient(145deg,#082447,#0b3466,#115d5f)] p-6 text-white">
                      <div className="mb-8 flex items-center justify-between">
                        <div>
                          <p className="text-sm uppercase tracking-[0.24em] text-amber-200/80">{currentCopy.energyWallet}</p>
                          <p className="mt-2 text-3xl font-semibold">924 SLT</p>
                        </div>
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-300 text-slate-950">
                          <Wallet className="h-7 w-7" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl bg-white/10 p-4">
                          <p className="text-white/60">{currentCopy.exported}</p>
                          <p className="mt-1 text-lg font-semibold">2,847 kWh</p>
                        </div>
                        <div className="rounded-2xl bg-white/10 p-4">
                          <p className="text-white/60">{currentCopy.imported}</p>
                          <p className="mt-1 text-lg font-semibold">1,923 kWh</p>
                        </div>
                      </div>

                      <div className="mt-5 rounded-[1.3rem] border border-white/10 bg-white/8 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-xs uppercase tracking-[0.22em] text-emerald-100/72">
                            {currentCopy.heroSignalsTitle}
                          </p>
                          <ArrowUpRight className="h-4 w-4 text-emerald-200" />
                        </div>
                        <div className="space-y-3">
                          {heroSignals.map((signal) => (
                            <div
                              key={signal.label}
                              className="flex items-center justify-between rounded-2xl bg-slate-950/25 px-4 py-3"
                            >
                              <span className="text-sm text-white/72">{signal.label}</span>
                              <span className={`text-sm font-semibold ${signal.tone}`}>{signal.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                              <TrendingUp className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{marketCopy.marketTitle}</p>
                              <p className="text-sm text-slate-500">{marketCopy.marketBody}</p>
                            </div>
                          </div>
                          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                            {isLoadingMarket ? "Syncing" : marketSyncLabel}
                          </div>
                        </div>
                        <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-slate-500">
                            <span>{marketCopy.updatedLabel}</span>
                            <span>{formatUpdatedTime(settings?.updated_at)}</span>
                          </div>
                          <div className="mt-2 flex items-end justify-between gap-4">
                            <div>
                              <p className="text-xs text-slate-500">{marketCopy.signalPrice}</p>
                              <p className="text-2xl font-semibold text-slate-900">{formatCurrency(livePrice)} MUR</p>
                            </div>
                            <div className={`rounded-full px-3 py-1 text-sm font-semibold ${changePercent >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                              {formatSignedPercent(changePercent)}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
                            <span>{marketCopy.baseLabel}</span>
                            <span className="font-semibold text-slate-900">{formatCurrency(basePrice)} MUR</span>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
                            <span>{marketCopy.clockLabel}</span>
                            <span className="font-semibold text-slate-900">{clockLabel}</span>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
                            <span>{marketCopy.signalPhase}</span>
                            <span className="font-semibold text-slate-900">{phaseLabel}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.4rem] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc,#eef6f5)] p-5 sm:col-span-2">
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{currentCopy.platformSignalsTitle}</p>
                        <div className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                          {currentCopy.active}
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        {[
                          currentCopy.signalOne,
                          currentCopy.signalTwo,
                          currentCopy.signalThree,
                        ].map((item) => (
                          <div key={item} className="flex items-start gap-3 rounded-2xl bg-white/60 px-4 py-4">
                            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                            <p className="text-sm text-slate-700">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[2.4rem] border border-white/10 bg-[linear-gradient(135deg,rgba(9,26,52,0.95),rgba(12,42,79,0.92),rgba(12,79,74,0.78))] p-8 shadow-[0_30px_110px_rgba(0,0,0,0.25)] sm:p-10">
            <div className="max-w-3xl">
              <p className="text-sm uppercase tracking-[0.24em] text-amber-200/85">{currentCopy.proofTitle}</p>
              <p className="mt-5 text-base leading-8 text-blue-50/78 sm:text-lg">{currentCopy.proofLead}</p>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {proofCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.06))] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur transition hover:-translate-y-1 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.08))]"
                >
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950/25 text-amber-300 ring-1 ring-white/10">
                    <card.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">{card.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-blue-50/74">{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="px-4 py-18 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-8 backdrop-blur">
              <p className="text-sm uppercase tracking-[0.25em] text-amber-200/80">{currentCopy.statsTitle}</p>
              <div className="mt-6 space-y-4">
                {[
                  currentCopy.aboutOne,
                  currentCopy.aboutTwo,
                  currentCopy.aboutThree,
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                    <p className="text-sm leading-6 text-white/78">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] p-8 shadow-[0_30px_90px_rgba(0,0,0,0.2)] backdrop-blur">
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {currentCopy.aboutTitle}
              </h2>
              <p className="mt-5 max-w-3xl text-base leading-8 text-white/72">{currentCopy.aboutText}</p>
            </div>
          </div>
        </section>

        <section id="features" className="px-4 py-18 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 max-w-3xl">
              <p className="text-sm uppercase tracking-[0.25em] text-amber-200/80">{currentCopy.features}</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {currentCopy.featuresTitle}
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-white/70">
                {currentCopy.featuresLead}
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.05))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.18)] backdrop-blur transition hover:-translate-y-1 hover:border-amber-300/20 hover:bg-white/[0.12]"
                >
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-300 text-slate-950">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-medium text-white">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-white/68">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-18 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[2.4rem] border border-white/10 bg-[linear-gradient(135deg,rgba(4,20,43,0.95),rgba(12,53,95,0.92),rgba(9,82,77,0.9))] p-8 shadow-[0_30px_120px_rgba(0,0,0,0.28)] sm:p-10">
            <div className="mb-10 max-w-2xl">
              <p className="text-sm uppercase tracking-[0.25em] text-amber-200/80">{currentCopy.flowLabel}</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {currentCopy.howItWorksTitle}
              </h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {steps.map((step) => (
                <div key={step.num} className="rounded-[1.8rem] bg-white/8 p-6 backdrop-blur">
                  <p className="text-sm font-medium tracking-[0.25em] text-amber-200">{step.num}</p>
                  <h3 className="mt-4 text-xl font-medium text-white">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-blue-50/76">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="px-4 py-18 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-10 text-center">
              <p className="text-sm uppercase tracking-[0.25em] text-amber-200/80">{currentCopy.faq}</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {currentCopy.faqTitle}
              </h2>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <div
                    key={faq.q}
                    className="overflow-hidden rounded-[1.7rem] border border-white/10 bg-white/[0.07] backdrop-blur"
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                    >
                      <span className="text-base font-medium text-white">{faq.q}</span>
                      <div
                        className={`rounded-full border border-white/12 p-2 transition ${
                          isOpen ? "rotate-180 bg-white/10" : "bg-transparent"
                        }`}
                      >
                        <ChevronDown className="h-4 w-4 text-amber-200" />
                      </div>
                    </button>
                    {isOpen ? (
                      <div className="px-6 pb-6">
                        <p className="max-w-3xl text-sm leading-7 text-white/68">{faq.a}</p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="contact" className="px-4 py-18 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.88fr_1.12fr]">
            <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] p-8 backdrop-blur">
              <p className="text-sm uppercase tracking-[0.25em] text-amber-200/80">{currentCopy.contact}</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {currentCopy.contactTitle}
              </h2>
              <p className="mt-5 max-w-lg text-base leading-8 text-white/72">{currentCopy.contactDesc}</p>
              <div className="mt-8 space-y-3 rounded-[1.5rem] border border-white/10 bg-slate-950/25 p-5">
                {[
                  currentCopy.contactOne,
                  currentCopy.contactTwo,
                  currentCopy.contactThree,
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                    <p className="text-sm leading-6 text-white/74">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <form
              onSubmit={handleContactSubmit}
              className="rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.94))] p-8 text-slate-900 shadow-[0_30px_100px_rgba(0,0,0,0.24)]"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-1">
                  <label className="mb-2 block text-sm font-medium text-slate-700">{currentCopy.nameLabel}</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="mb-2 block text-sm font-medium text-slate-700">{currentCopy.emailLabel}</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">{currentCopy.messageLabel}</label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={5}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingContact}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#f2b61f,#f59e0b,#1f8f74)] px-6 py-4 text-sm font-semibold text-slate-950 shadow-[0_18px_40px_rgba(245,158,11,0.26)] transition hover:brightness-105"
              >
                {isSubmittingContact ? currentCopy.contactSending : currentCopy.formButton}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </section>

        <section className="px-4 pb-20 pt-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[2.3rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.05))] px-8 py-10 backdrop-blur">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm uppercase tracking-[0.25em] text-amber-200/80">{currentCopy.getStartedLabel}</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {currentCopy.ctaTitle}
                </h2>
                <p className="mt-4 text-base leading-8 text-white/72">{currentCopy.ctaBody}</p>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row">
                <Link
                  to="/apply"
                  className="inline-flex items-center justify-center rounded-full bg-white px-6 py-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  {applyNowLabel}
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  {currentCopy.getStarted}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div className="flex items-center justify-center gap-3 sm:justify-start">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden">
              <BrandLogo className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="font-medium text-white">SoleyVolt</p>
              <p className="text-sm text-white/55">{currentCopy.tagline}</p>
            </div>
          </div>
          <p className="text-sm text-white/52">{currentCopy.footerCopy}</p>
        </div>
      </footer>
    </div>
  );
}
