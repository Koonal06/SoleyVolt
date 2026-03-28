import {
  Bolt,
  FileSearch,
  LogOut,
  Settings2,
  ShieldCheck,
  ShieldPlus,
  ScrollText,
  Users,
} from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { BrandLogo } from "../components/BrandLogo";
import { useAuth } from "../providers/AuthProvider";

const navItems = [
  { icon: ShieldCheck, label: "Super Dashboard", path: "/super-admin/dashboard" },
  { icon: ShieldPlus, label: "Admins", path: "/super-admin/admins" },
  { icon: Users, label: "Users", path: "/super-admin/users" },
  { icon: FileSearch, label: "Applications", path: "/super-admin/applications" },
  { icon: Bolt, label: "System", path: "/super-admin/system" },
  { icon: ScrollText, label: "Logs", path: "/super-admin/logs" },
  { icon: Settings2, label: "Settings", path: "/super-admin/settings" },
];

export function SuperAdminPortalLayout() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const handleLogout = async () => {
    const { error } = (await supabase?.auth.signOut()) ?? { error: null };

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Super admin logout successful.");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#050812] text-white">
      <div className="grid min-h-screen xl:grid-cols-[360px_1fr]">
        <aside className="border-r border-white/10 bg-[linear-gradient(180deg,#03060d_0%,#0a1120_44%,#17334d_100%)] p-6">
          <Link to="/" className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden">
              <BrandLogo className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-lg font-semibold">SoleyVolt</p>
              <p className="text-xs text-white/55">Super Admin Portal</p>
            </div>
          </Link>

          <div className="mb-8 rounded-3xl border border-amber-300/20 bg-amber-400/10 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-amber-200/85">Highest Access</p>
            <p className="mt-3 text-xl font-semibold">{profile?.full_name || user?.email || "Super Admin"}</p>
            <p className="mt-1 text-sm text-white/55">{user?.email}</p>
            <p className="mt-4 text-sm leading-6 text-white/72">
              Control admin onboarding, audit system operations, and manage platform-wide access from one secure command layer.
            </p>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/super-admin/dashboard"}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-3 transition ${
                    isActive ? "bg-amber-300 text-slate-950" : "text-white/76 hover:bg-white/8 hover:text-white"
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
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.14),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.09),_transparent_24%)]" />
          <header className="relative border-b border-white/10 bg-black/25 px-6 py-5 backdrop-blur sm:px-8">
            <p className="text-sm uppercase tracking-[0.18em] text-amber-200/85">Super Admin Portal</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Governance, access control, and platform visibility</h1>
          </header>
          <main className="relative flex-1 px-6 py-6 sm:px-8 sm:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
