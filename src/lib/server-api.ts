import { supabase } from "./supabase";
import type {
  AdminOverviewRow,
  NotificationRow,
  UserWalletSummaryRow,
  WalletTransactionRow,
} from "./supabase-data";

const defaultServerApiBaseUrl = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/server/make-server-2c83666d/api`
  : "";

const serverApiKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "";

export const serverApiBaseUrl =
  import.meta.env.VITE_SERVER_API_BASE_URL ?? defaultServerApiBaseUrl;

type ServerApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
};

export async function serverApiRequest<T>(path: string, options: ServerApiOptions = {}) {
  if (!serverApiBaseUrl) {
    throw new Error("Server API base URL is not configured.");
  }

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  if (!serverApiKey) {
    throw new Error("Supabase publishable key is required for the server API.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("You must be signed in to use the server API.");
  }

  const response = await fetch(`${serverApiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      apikey: serverApiKey,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(data?.error ?? `Server request failed (${response.status}).`);
  }

  return data as T;
}

export type AdminDashboardSnapshot = {
  overview: AdminOverviewRow | null;
  users: UserWalletSummaryRow[];
  transactions: WalletTransactionRow[];
  alerts: NotificationRow[];
};

export function getAdminDashboardSnapshot() {
  return serverApiRequest<AdminDashboardSnapshot>("/admin/overview");
}

export function sendAdminPasswordReset(userId: string, redirectTo: string) {
  return serverApiRequest<{ ok: true; email: string }>(`/admin/users/${userId}/password-reset`, {
    method: "POST",
    body: { redirectTo },
  });
}
