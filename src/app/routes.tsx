import { createBrowserRouter, isRouteErrorResponse, Link, Navigate, useLocation, useRouteError } from "react-router";
import { AdminRoute, ProtectedRoute, PublicOnlyRoute, SuperAdminRoute, UserRoute } from "./components/AuthGate";
import { LandingPage } from "./pages/LandingPage";
import { AuthPage } from "./pages/AuthPage";
import { AdminAuthPage } from "./pages/AdminAuthPage";
import { SuperAdminAuthPage } from "./pages/SuperAdminAuthPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { ApplyNowPage } from "./pages/ApplyNowPage";
import { UserPortalLayout } from "./layouts/UserPortalLayout";
import { AdminPortalLayout } from "./layouts/AdminPortalLayout";
import { SuperAdminPortalLayout } from "./layouts/SuperAdminPortalLayout";
import { Dashboard } from "./pages/Dashboard";
import { Wallet } from "./pages/Wallet";
import { BillPage } from "./pages/BillPage";
import { CoinMarketplacePage } from "./pages/CoinMarketplacePage";
import { Settings } from "./pages/Settings";
import { TransactionHistory } from "./pages/TransactionHistory";
import { Transfer } from "./pages/Transfer";
import { SystemDashboard } from "./pages/SystemDashboard";
import { UserManagement } from "./pages/UserManagement";
import { AdminLogsPage } from "./pages/AdminLogsPage";
import { AdminSettingsPage } from "./pages/AdminSettingsPage";
import { EnergyPipelineAdminPage } from "./pages/EnergyPipelineAdminPage";
import { AdminWalletsPage } from "./pages/AdminWalletsPage";
import { AdminBillsPage } from "./pages/AdminBillsPage";
import { SuperAdminAdminsPage } from "./pages/SuperAdminAdminsPage";
import { AdminApplicationsPage } from "./pages/AdminApplicationsPage";

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
            to="/login"
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
    path: "/apply",
    Component: ApplyNowPage,
    errorElement: <RouteErrorBoundary />,
  },
  {
    Component: PublicOnlyRoute,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: "/login", Component: AuthPage },
      { path: "/auth", element: <Navigate to="/login" replace /> },
      { path: "/admin/login", Component: AdminAuthPage },
      { path: "/super-admin/login", Component: SuperAdminAuthPage },
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
              { path: "transfer", Component: Transfer },
              { path: "bill", Component: BillPage },
              { path: "market", Component: CoinMarketplacePage },
              { path: "history", Component: TransactionHistory },
              { path: "settings", Component: Settings },
            ],
          },
        ],
      },
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
              { path: "applications", Component: AdminApplicationsPage },
              { path: "users", Component: UserManagement },
              { path: "readings", Component: EnergyPipelineAdminPage },
              { path: "wallets", Component: AdminWalletsPage },
              { path: "bills", Component: AdminBillsPage },
              { path: "logs", Component: AdminLogsPage },
              { path: "settings", Component: AdminSettingsPage },
            ],
          },
        ],
      },
      {
        Component: SuperAdminRoute,
        errorElement: <RouteErrorBoundary />,
        children: [
          {
            path: "/super-admin",
            Component: SuperAdminPortalLayout,
            errorElement: <RouteErrorBoundary />,
            children: [
              { index: true, Component: SystemDashboard },
              { path: "dashboard", Component: SystemDashboard },
              { path: "admins", Component: SuperAdminAdminsPage },
              { path: "users", Component: UserManagement },
              { path: "applications", Component: AdminApplicationsPage },
              { path: "system", Component: EnergyPipelineAdminPage },
              { path: "logs", Component: AdminLogsPage },
              { path: "settings", Component: AdminSettingsPage },
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
