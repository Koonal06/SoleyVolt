import { createBrowserRouter, isRouteErrorResponse, Link, Navigate, useLocation, useRouteError } from "react-router";
import { AdminProtectedRoute, AdminRoute, ProtectedRoute, PublicOnlyRoute, UserRoute } from "./components/AuthGate";
import { LandingPage } from "./pages/LandingPage";
import { AuthPage } from "./pages/AuthPage";
import { AdminAuthPage } from "./pages/AdminAuthPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { UserPortalLayout } from "./layouts/UserPortalLayout";
import { AdminPortalLayout } from "./layouts/AdminPortalLayout";
import { Dashboard } from "./pages/Dashboard";
import { Wallet } from "./pages/Wallet";
import { BillPage } from "./pages/BillPage";
import { Settings } from "./pages/Settings";
import { TransactionHistory } from "./pages/TransactionHistory";
import { SystemDashboard } from "./pages/SystemDashboard";
import { UserManagement } from "./pages/UserManagement";
import { EnergyMonitoring } from "./pages/EnergyMonitoring";
import { PurchasesPage } from "./pages/PurchasesPage";
import { AdminLogsPage } from "./pages/AdminLogsPage";
import { AdminSettingsPage } from "./pages/AdminSettingsPage";
import { SupabaseTestPage } from "./pages/SupabaseTestPage";

function normalizePathname(pathname: string) {
  const normalized = pathname.replace(/\/{2,}/g, "/");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function RouteErrorBoundary() {
  const error = useRouteError();

  let title = "Something went wrong";
  let message = "The page could not be loaded. Please try again.";

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    message =
      error.status === 404
        ? "That page could not be found. If the URL looks odd, try returning to the portal and opening it again."
        : message;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-300/80">SoleyVolt</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">{message}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/"
            className="rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105"
          >
            Return Home
          </Link>
          <Link
            to="/auth"
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Open Login
          </Link>
        </div>
      </div>
    </div>
  );
}

function RouteRecoveryPage() {
  const location = useLocation();
  const normalizedPath = normalizePathname(location.pathname);

  if (normalizedPath !== location.pathname) {
    return <Navigate to={`${normalizedPath}${location.search}${location.hash}`} replace />;
  }

  return <Navigate to="/" replace />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LandingPage,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/auth/reset",
    Component: ResetPasswordPage,
    errorElement: <RouteErrorBoundary />,
  },
  {
    Component: PublicOnlyRoute,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: "/auth", Component: AuthPage },
      { path: "/admin/login", Component: AdminAuthPage },
    ],
  },
  {
    Component: ProtectedRoute,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        Component: UserRoute,
        errorElement: <RouteErrorBoundary />,
        children: [
          {
            path: "/app",
            Component: UserPortalLayout,
            errorElement: <RouteErrorBoundary />,
            children: [
              { index: true, Component: Dashboard },
              { path: "dashboard", Component: Dashboard },
              { path: "wallet", Component: Wallet },
              { path: "bill", Component: BillPage },
              { path: "history", Component: TransactionHistory },
              { path: "supabase-test", Component: SupabaseTestPage },
              { path: "settings", Component: Settings },
            ],
          },
        ],
      },
      {
        Component: AdminProtectedRoute,
        errorElement: <RouteErrorBoundary />,
        children: [
          {
            Component: AdminRoute,
            errorElement: <RouteErrorBoundary />,
            children: [
              {
                path: "/admin",
                Component: AdminPortalLayout,
                errorElement: <RouteErrorBoundary />,
                children: [
                  { index: true, Component: SystemDashboard },
                  { path: "dashboard", Component: SystemDashboard },
                  { path: "users", Component: UserManagement },
                  { path: "energy", Component: EnergyMonitoring },
                  { path: "purchases", Component: PurchasesPage },
                  { path: "logs", Component: AdminLogsPage },
                  { path: "settings", Component: AdminSettingsPage },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: "*",
    Component: RouteRecoveryPage,
    errorElement: <RouteErrorBoundary />,
  },
]);
