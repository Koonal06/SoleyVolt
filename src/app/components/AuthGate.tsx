import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../providers/AuthProvider";
import { canAccessRole, roleHomePath, roleLoginPath, type AppRole } from "../lib/access";

function FullScreenMessage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 text-center text-white">
      <p className="max-w-md text-sm text-slate-200">{message}</p>
    </div>
  );
}

type RoleGateProps = {
  allowedRoles: readonly AppRole[];
  loginPath: string;
};

export function ProtectedRoute() {
  const { isConfigured, isLoading, session } = useAuth();
  const location = useLocation();

  if (!isConfigured) {
    return (
      <FullScreenMessage message="Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your .env file." />
    );
  }

  if (isLoading) {
    return <FullScreenMessage message="Checking your session..." />;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function RoleProtectedRoute({ allowedRoles, loginPath }: RoleGateProps) {
  const { session, profile, isProfileLoading } = useAuth();
  const location = useLocation();

  if (session && isProfileLoading) {
    return <FullScreenMessage message="Loading your account..." />;
  }

  if (session && !profile) {
    return <FullScreenMessage message="We could not load your account profile. Please sign out and try again." />;
  }

  if (!session) {
    return <Navigate to={loginPath} replace state={{ from: location }} />;
  }

  if (!canAccessRole(profile?.role, allowedRoles)) {
    return <Navigate to={roleHomePath[profile?.role ?? "user"]} replace />;
  }

  if (profile?.status && profile.status !== "active") {
    return <FullScreenMessage message="Your account is not active right now. Please contact an administrator." />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { isConfigured, isLoading, isProfileLoading, session, defaultRoute } = useAuth();
  const location = useLocation();
  const redirectTo =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? defaultRoute;

  if (!isConfigured) {
    return <Outlet />;
  }

  if (isLoading) {
    return <FullScreenMessage message="Checking your session..." />;
  }

  if (session && isProfileLoading) {
    return <FullScreenMessage message="Finalizing your sign-in..." />;
  }

  if (session) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}

export function UserRoute() {
  return <RoleProtectedRoute allowedRoles={["user"]} loginPath={roleLoginPath.user} />;
}

export function AdminRoute() {
  return <RoleProtectedRoute allowedRoles={["admin"]} loginPath={roleLoginPath.admin} />;
}

export function SuperAdminRoute() {
  return <RoleProtectedRoute allowedRoles={["superadmin"]} loginPath={roleLoginPath.superadmin} />;
}
