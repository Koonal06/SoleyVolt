import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../providers/AuthProvider";

function FullScreenMessage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 text-center text-white">
      <p className="max-w-md text-sm text-slate-200">{message}</p>
    </div>
  );
}

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
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function AdminProtectedRoute() {
  const { isConfigured, isLoading, session } = useAuth();
  const location = useLocation();

  if (!isConfigured) {
    return (
      <FullScreenMessage message="Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your .env file." />
    );
  }

  if (isLoading) {
    return <FullScreenMessage message="Checking your admin session..." />;
  }

  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function UserRoute() {
  const { profile, isAdmin } = useAuth();

  if (isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (profile?.status && profile.status !== "active") {
    return <FullScreenMessage message="Your account is not active right now. Please contact an administrator." />;
  }

  return <Outlet />;
}

export function AdminRoute() {
  const { profile, isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  if (profile?.status && profile.status !== "active") {
    return <FullScreenMessage message="Your admin account is not active right now." />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { isConfigured, isLoading, session, defaultRoute } = useAuth();
  const location = useLocation();
  const redirectTo =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? defaultRoute;

  if (!isConfigured) {
    return <Outlet />;
  }

  if (isLoading) {
    return <FullScreenMessage message="Checking your session..." />;
  }

  if (session) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
