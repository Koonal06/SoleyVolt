import {
  AlertTriangle,
  ArrowLeftRight,
  Coins,
  Gauge,
  LogOut,
  Settings2,
  Shield,
  Users,
  Zap,
} from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { BrandLogo } from "../components/BrandLogo";
import { useAuth } from "../providers/AuthProvider";

const navItems = [
  { icon: Gauge, label: "System Dashboard", path: "/admin/dashboard" },
  { icon: Users, label: "User Management", path: "/admin/users" },
  { icon: Zap, label: "Energy Monitoring", path: "/admin/energy" },
  { icon: Coins, label: "Purchases", path: "/admin/purchases" },
  { icon: ArrowLeftRight, label: "Logs", path: "/admin/logs" },
  { icon: Settings2, label: "Settings", path: "/admin/settings" },
];

export function AdminPortalLayout() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const handleLogout = async () => {
    const { error } = await supabase?.auth.signOut() ?? { error: null };

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Admin logout successful.");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#08111d] text-white">
      <div className="grid min-h-screen xl:grid-cols-[340px_1fr]">
        <aside className="border-r border-white/10 bg-[linear-gradient(180deg,#050b13_0%,#0b1624_48%,#13263a_100%)] p-6">
          <Link to="/" className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden">
              <BrandLogo className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-lg font-semibold">SoleyVolt</p>
              <p className="text-xs text-white/55">Admin Portal</p>
            </div>
          </Link>

          <div className="mb-8 rounded-3xl border border-emerald-400/15 bg-emerald-400/8 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Restricted Access</p>
            <p className="mt-3 text-xl font-semibold">{profile?.full_name || user?.email || "Administrator"}</p>
            <p className="mt-1 text-sm text-white/55">{user?.email}</p>
            <p className="mt-4 text-sm leading-6 text-white/72">
              Monitor circulation, investigate anomalies, and manage system-wide policy from one control surface.
            </p>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/admin/dashboard"}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-3 transition ${
                    isActive ? "bg-white text-slate-950" : "text-white/74 hover:bg-white/7 hover:text-white"
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
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </aside>

        <div className="relative flex min-h-screen flex-col">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.1),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.1),_transparent_24%)]" />
          <header className="relative border-b border-white/10 bg-black/20 px-6 py-5 backdrop-blur sm:px-8">
            <p className="text-sm uppercase tracking-[0.18em] text-emerald-200/82">Admin Portal</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Monitoring, control, and traceability</h1>
          </header>
          <main className="relative flex-1 px-6 py-6 sm:px-8 sm:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
