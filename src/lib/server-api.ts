import { supabase } from "./supabase";
import type {
  AdminOverviewRow,
  AdminProfileOptionRow,
  DatasetUserMappingRow,
  EnergyImportAdminRow,
  NotificationRow,
  ProfileRow,
  UserWalletSummaryRow,
  WalletTransactionRow,
} from "./supabase-data";

const defaultServerApiBaseUrl = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/server/api`
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

async function getFreshAccessToken(forceRefresh = false) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const {
    data: { session: currentSession },
  } = await supabase.auth.getSession();

  const expiresSoon =
    typeof currentSession?.expires_at === "number"
      ? currentSession.expires_at * 1000 <= Date.now() + 60_000
      : false;

  if (forceRefresh || !currentSession?.access_token || expiresSoon) {
    const { data, error } = await supabase.auth.refreshSession();

    if (error) {
      throw error;
    }

    if (!data.session?.access_token) {
      throw new Error("You must be signed in to use the server API.");
    }

    return data.session.access_token;
  }

  return currentSession.access_token;
}

export async function serverApiRequest<T>(path: string, options: ServerApiOptions = {}) {
  if (!serverApiBaseUrl) {
    throw new Error("Server API base URL is not configured.");
  }

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const makeRequest = async (accessToken: string) =>
    fetch(`${serverApiBaseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(serverApiKey ? { apikey: serverApiKey } : {}),
        Authorization: `Bearer ${accessToken}`,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

  let response = await makeRequest(await getFreshAccessToken());
  let data = (await response.json().catch(() => null)) as { error?: string } | null;

  if (response.status === 401) {
    response = await makeRequest(await getFreshAccessToken(true));
    data = (await response.json().catch(() => null)) as { error?: string } | null;
  }

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

export type EnergyPipelineSnapshot = {
  imports: EnergyImportAdminRow[];
  mappings: DatasetUserMappingRow[];
  profiles: AdminProfileOptionRow[];
  latestRun: EnergyPipelineRun | null;
};

export type EnergyPipelineRun = {
  id: string;
  trigger_source: string;
  status: "running" | "completed" | "completed_with_errors" | "failed" | "skipped";
  calculation_version: string;
  rows_considered: number;
  processed_count: number;
  failed_count: number;
  promoted_count: number;
  statuses_filter: string[];
  promote: boolean;
  dry_run: boolean;
  anchor_date: string | null;
  started_at: string;
  completed_at: string | null;
  error_summary: string | null;
};

export type ManagedUserPayload = {
  full_name: string;
  email: string;
  password: string;
  language: "en" | "fr" | "cr";
  status: "active" | "inactive" | "suspended";
  user_type: "consumer" | "producer" | "prosumer";
};

export type ManagedAdminPayload = {
  full_name: string;
  email: string;
  password: string;
  language: "en" | "fr" | "cr";
  status: "active" | "inactive" | "suspended";
};

export type DatasetUserMappingPayload = {
  datasetUserType?: "consumer" | "producer" | "prosumer";
  sourceFileName?: string | null;
  notes?: string | null;
};

export function getAdminDashboardSnapshot() {
  return serverApiRequest<AdminDashboardSnapshot>("/admin/overview");
}

export function getEnergyPipelineSnapshot() {
  return serverApiRequest<EnergyPipelineSnapshot>("/admin/energy-pipeline");
}

export function saveDatasetUserMapping(datasetUserCode: string, linkedUserId: string, payload: DatasetUserMappingPayload = {}) {
  return serverApiRequest<DatasetUserMappingRow>(`/admin/energy-pipeline/mappings/${encodeURIComponent(datasetUserCode)}`, {
    method: "POST",
    body: {
      linkedUserId,
      datasetUserType: payload.datasetUserType ?? null,
      sourceFileName: payload.sourceFileName ?? null,
      notes: payload.notes ?? null,
    },
  });
}

export function createManagedUserAccount(payload: ManagedUserPayload) {
  return serverApiRequest<{ user: { id: string; email: string; role: "user"; status: ManagedUserPayload["status"] } }>(
    "/admin/users",
    {
      method: "POST",
      body: payload,
    },
  );
}

export function createManagedAdminAccount(payload: ManagedAdminPayload) {
  return serverApiRequest<{ user: { id: string; email: string; role: "admin"; status: ManagedAdminPayload["status"] } }>(
    "/super-admin/admins",
    {
      method: "POST",
      body: payload,
    },
  );
}

export function getManagedAdminAccounts() {
  return serverApiRequest<ProfileRow[]>("/super-admin/admins");
}

export function sendManagedPasswordReset(userId: string, redirectTo: string) {
  return serverApiRequest<{ ok: true; email: string }>(`/admin/users/${userId}/password-reset`, {
    method: "POST",
    body: { redirectTo },
  });
}
