import {
  BadgeDollarSign,
  CircleDollarSign,
  CircleUserRound,
  Coins,
  History,
  LayoutDashboard,
  LogOut,
  Send,
  Wallet,
} from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { useAppLanguage } from "../lib/language";
import { getUserPortalCopy } from "../lib/user-portal-copy";
import { BrandLogo } from "../components/BrandLogo";
import { useAuth } from "../providers/AuthProvider";

export function UserPortalLayout() {
  const navigate = useNavigate();
  const { profile, user, userType } = useAuth();
  const language = useAppLanguage(profile?.language);
  const copy = getUserPortalCopy(language);

  const handleLogout = async () => {
    const { error } = await supabase?.auth.signOut() ?? { error: null };

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(copy.layout.logoutSuccess);
    navigate("/", { replace: true });
  };

  const userName = profile?.full_name || user?.user_metadata?.full_name || user?.email || copy.layout.userFallback;
  const navItems = [
    { icon: LayoutDashboard, label: copy.layout.dashboard, path: "/app/dashboard" },
    { icon: Wallet, label: userType === "producer" ? copy.layout.creditsWallet : copy.layout.wallet, path: "/app/wallet" },
    { icon: Send, label: copy.layout.transfer, path: "/app/transfer" },
    {
      icon: userType === "producer" ? BadgeDollarSign : CircleDollarSign,
      label: userType === "producer" ? copy.layout.settlement : copy.layout.bill,
      path: "/app/bill",
    },
    {
      icon: Coins,
      label: userType === "producer" ? "Sell Coins" : "Coin Market",
      path: "/app/market",
    },
    { icon: History, label: copy.layout.history, path: "/app/history" },
    { icon: CircleUserRound, label: copy.layout.settings, path: "/app/settings" },
  ];
  const portalSubtitle =
    userType === "consumer"
      ? copy.layout.consumerSubtitle
      : userType === "producer"
        ? copy.layout.producerSubtitle
        : copy.layout.prosumerSubtitle;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbfc_0%,#eef5f4_52%,#e8f0f0_100%)] text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[300px_1fr]">
        <aside className="border-r border-slate-200 bg-[linear-gradient(180deg,#08243f_0%,#0b355a_58%,#0d5d58_100%)] p-6 text-white">
          <Link to="/" className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden">
              <BrandLogo className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-lg font-semibold">SoleyVolt</p>
              <p className="text-xs text-white/65">{copy.layout.portal}</p>
            </div>
          </Link>

          <div className="mb-8 rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.22em] text-amber-200/80">{copy.layout.access}</p>
            <p className="mt-3 text-xl font-semibold">{userName}</p>
            <p className="mt-1 text-sm text-white/68">{user?.email}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-emerald-200/80">{userType ?? "user"}</p>
            <p className="mt-4 text-sm text-white/72">
              {portalSubtitle}
            </p>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/app/dashboard"}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-3 transition ${
                    isActive ? "bg-amber-400 text-slate-950" : "text-white/82 hover:bg-white/10"
                  }`
                }
              >
                <item.icon className="h-5 w-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <button
            onClick={handleLogout}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/12"
          >
            <LogOut className="h-5 w-5" />
            {copy.layout.signOut}
          </button>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="border-b border-slate-200 bg-white/80 px-6 py-5 backdrop-blur sm:px-8">
            <p className="text-sm uppercase tracking-[0.18em] text-emerald-700">{copy.layout.portal}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {userType === "consumer"
                ? copy.layout.consumerTitle
                : userType === "producer"
                  ? copy.layout.producerTitle
                  : copy.layout.prosumerTitle}
            </h1>
          </header>
          <main className="flex-1 px-6 py-6 sm:px-8 sm:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
