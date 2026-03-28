import { supabase } from "./supabase";
import type {
  AdminOverviewRow,
  AdminProfileOptionRow,
  DatasetUserMappingRow,
  EnergyImportAdminRow,
  NotificationRow,
  ProfileRow,
  PublicUserRow,
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

const serverFunctionBaseUrl = serverApiBaseUrl.endsWith("/api")
  ? serverApiBaseUrl.slice(0, -4)
  : serverApiBaseUrl;

type ServerApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
};

type PublicServerApiOptions = {
  method?: "GET" | "POST";
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

export async function publicServerApiRequest<T>(path: string, options: PublicServerApiOptions = {}) {
  if (!serverFunctionBaseUrl) {
    throw new Error("Server API base URL is not configured.");
  }

  const response = await fetch(`${serverFunctionBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(serverApiKey ? { apikey: serverApiKey } : {}),
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

export type EnergyPipelineRunRequest = {
  limit?: number;
  statuses?: string[];
  calculationVersion?: string;
  anchorDate?: string | null;
  promote?: boolean;
  dryRun?: boolean;
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

export type UserApplicationStatus = "pending" | "under_review" | "approved" | "rejected";

export type UserApplicationRecord = {
  id: string;
  full_name: string;
  nic: string;
  email: string;
  phone: string;
  address: string;
  preferred_language: "en" | "fr" | "cr";
  requested_user_type: "consumer" | "producer" | "prosumer";
  notes: string | null;
  status: UserApplicationStatus;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_by_email: string | null;
  rejection_reason: string | null;
  linked_profile_id: string | null;
  linked_profile_name: string | null;
  linked_profile_email: string | null;
};

export type UserApplicationEvent = {
  id: string;
  application_id: string;
  action: "submitted" | "under_review" | "approved" | "rejected" | "account_created" | "note";
  from_status: UserApplicationStatus | null;
  to_status: UserApplicationStatus | null;
  actor_profile_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  actor_profile_email: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type UserApplicationsSnapshot = {
  applications: UserApplicationRecord[];
  events: UserApplicationEvent[];
};

export type PublicUserApplicationPayload = {
  full_name: string;
  nic: string;
  email: string;
  phone: string;
  address: string;
  preferred_language?: "en" | "fr" | "cr";
  applicant_type?: "consumer" | "producer" | "prosumer";
  notes?: string;
};

export type ApproveUserApplicationPayload = {
  preferred_language?: "en" | "fr" | "cr";
  user_type?: "consumer" | "producer" | "prosumer";
  sendPasswordSetupEmail?: boolean;
  redirectTo?: string;
};

export type WalletTokenBalances = {
  user_id: string;
  yellow_token: number;
  red_token: number;
  green_token: number;
  yellow_balance: number;
  red_balance: number;
  green_balance: number;
  balance: number;
  updated_at: string;
};

export type EnrichedTransactionHistoryItem = {
  id: string;
  sender_id: string | null;
  receiver_id: string | null;
  token_type: string;
  amount: number;
  amount_rs: number;
  description: string;
  status: "pending" | "completed" | "failed";
  created_at: string;
  direction: "sent" | "received" | "system";
  note?: string | null;
};

export type UserTransactionHistoryResponse = {
  success: boolean;
  user_id: string;
  total_transactions: number;
  transactions: EnrichedTransactionHistoryItem[];
  error?: string;
};

export type PeerGreenPurchaseResponse = {
  success: boolean;
  buyer_id?: string;
  seller_id?: string;
  amount_rs?: number;
  yellow_deducted_from_seller?: number;
  green_added_to_buyer?: number;
  buyer_balances?: WalletTokenBalances;
  seller_balances?: WalletTokenBalances;
  transaction_record?: {
    sender_record: Record<string, unknown>;
    receiver_record: Record<string, unknown>;
  };
  green_purchase_record?: Record<string, unknown>;
  cap_status?: {
    limit: number;
    existing: number;
    requested: number;
    remaining: number;
  };
  error?: string;
  cap_limit?: number;
  existing_purchases?: number;
  requested?: number;
  available?: number;
};

export type EndOfMonthSettlementResponse = {
  success: boolean;
  user_id?: string;
  month?: string;
  green_used?: number;
  red_before?: number;
  red_after?: number;
  green_before?: number;
  green_after?: number;
  settlement_record?: Record<string, unknown> | null;
  message?: string;
  error?: string;
};

export type AllUsersEndOfMonthSettlementResponse = {
  success: boolean;
  month: string;
  total_users_processed: number;
  total_green_used_across_all_users: number;
  total_red_remaining_across_all_users: number;
  results: EndOfMonthSettlementResponse[];
  errors: Array<{ user_id?: string; error: string }>;
};

export type GreenPurchaseRequestCounterparty = {
  id: string;
  name: string | null;
  email: string | null;
};

export type GreenPurchaseRequestRecord = {
  id: string;
  buyer_id: string;
  seller_id: string;
  amount_rs: number;
  yellow_amount: number;
  green_amount: number;
  status: "pending" | "accepted" | "rejected" | "expired" | "completed";
  created_at: string;
  updated_at: string;
  accepted_at?: string | null;
  rejected_at?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  role?: "buyer" | "seller" | null;
  counterparty?: GreenPurchaseRequestCounterparty | null;
  buyer?: GreenPurchaseRequestCounterparty | null;
  seller?: GreenPurchaseRequestCounterparty | null;
};

export type GreenPurchaseRequestCreateResponse = {
  success: boolean;
  request_id?: string;
  buyer_id?: string;
  seller_id?: string;
  amount_rs?: number;
  yellow_amount?: number;
  green_amount?: number;
  status?: GreenPurchaseRequestRecord["status"];
  cap_status?: {
    limit: number;
    existing: number;
    requested: number;
    available: number;
    remaining?: number;
  };
  error?: string;
  cap_limit?: number;
  existing?: number;
  requested?: number;
  available?: number;
};

export type PendingGreenPurchaseRequestsResponse = {
  success: boolean;
  user_id: string;
  as_seller: boolean;
  total_pending: number;
  requests: GreenPurchaseRequestRecord[];
  error?: string;
};

export type GreenPurchaseRequestHistoryResponse = {
  success: boolean;
  user_id: string;
  total: number;
  requests: GreenPurchaseRequestRecord[];
  error?: string;
};

export type MarketplaceSellerOption = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  user_type: "producer" | "prosumer";
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

export function runEnergyPipelineNow(payload: EnergyPipelineRunRequest = {}) {
  return serverApiRequest<EnergyPipelineRun & { errors: Array<{ import_id: string; dataset_user_code: string; billing_cycle: number; error: string; trigger_source: string }> }>(
    "/admin/energy-pipeline/run",
    {
      method: "POST",
        body: {
          limit: payload.limit ?? 100,
          statuses: payload.statuses ?? ["pending", "failed", "calculated"],
          calculationVersion: payload.calculationVersion ?? null,
          anchorDate: payload.anchorDate ?? null,
          promote: payload.promote ?? true,
        dryRun: payload.dryRun ?? false,
      },
    },
  );
}

export function submitUserApplication(payload: PublicUserApplicationPayload) {
  return publicServerApiRequest<{ message: string; application: UserApplicationRecord }>("/public/applications", {
    method: "POST",
    body: payload,
  });
}

export function getAdminApplications() {
  return serverApiRequest<UserApplicationsSnapshot>("/admin/applications");
}

export function updateAdminApplicationStatus(
  applicationId: string,
  payload: {
    status: Exclude<UserApplicationStatus, "pending" | "approved">;
    rejection_reason?: string;
    notes?: string;
  },
) {
  return serverApiRequest<UserApplicationRecord>(`/admin/applications/${applicationId}/status`, {
    method: "POST",
    body: payload,
  });
}

export function approveAdminApplication(applicationId: string, payload: ApproveUserApplicationPayload = {}) {
  return serverApiRequest<{
    application: UserApplicationRecord;
    user: {
      id: string;
      email: string;
      role: "user";
      status: "active";
      user_type: "consumer" | "producer" | "prosumer";
    };
    invitation: {
      passwordSetupEmailSent: boolean;
      redirectTo: string | null;
      temporaryPassword: string | null;
    };
  }>(`/admin/applications/${applicationId}/approve`, {
    method: "POST",
    body: payload,
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

export function purchasePeerGreenTokens(sellerId: string, amountRs: number) {
  return serverApiRequest<PeerGreenPurchaseResponse>("/green-tokens/purchase", {
    method: "POST",
    body: {
      seller_id: sellerId,
      amount_rs: amountRs,
    },
  });
}

export function createGreenPurchaseRequest(sellerId: string, amountRs: number) {
  return serverApiRequest<GreenPurchaseRequestCreateResponse>("/green-tokens/requests", {
    method: "POST",
    body: {
      seller_id: sellerId,
      amount_rs: amountRs,
    },
  });
}

export function acceptGreenPurchaseRequest(requestId: string) {
  return serverApiRequest<PeerGreenPurchaseResponse>(`/green-tokens/requests/${encodeURIComponent(requestId)}/accept`, {
    method: "POST",
  });
}

export function rejectGreenPurchaseRequest(requestId: string, reason?: string) {
  return serverApiRequest<{
    success: boolean;
    request_id?: string;
    status?: GreenPurchaseRequestRecord["status"];
    buyer_id?: string;
    seller_id?: string;
    message?: string;
    error?: string;
  }>(`/green-tokens/requests/${encodeURIComponent(requestId)}/reject`, {
    method: "POST",
    body: {
      reason: reason ?? null,
    },
  });
}

export function getPendingGreenPurchaseRequests(asSeller = true) {
  return serverApiRequest<PendingGreenPurchaseRequestsResponse>(
    `/green-tokens/requests/pending?as_seller=${asSeller ? "true" : "false"}`,
  );
}

export function getGreenPurchaseRequestHistory(payload: { statusFilter?: string; limit?: number } = {}) {
  const params = new URLSearchParams();

  if (payload.statusFilter) {
    params.set("status", payload.statusFilter);
  }

  if (typeof payload.limit === "number" && Number.isFinite(payload.limit)) {
    params.set("limit", String(payload.limit));
  }

  const query = params.toString();
  return serverApiRequest<GreenPurchaseRequestHistoryResponse>(
    `/green-tokens/requests/history${query ? `?${query}` : ""}`,
  );
}

export function processEndOfMonthSettlement(payload: { userId?: string; month?: string } = {}) {
  return serverApiRequest<EndOfMonthSettlementResponse>("/green-tokens/settlement", {
    method: "POST",
    body: {
      user_id: payload.userId ?? null,
      month: payload.month ?? null,
    },
  });
}

export function processAllUsersEndOfMonth(payload: { month?: string } = {}) {
  return serverApiRequest<AllUsersEndOfMonthSettlementResponse>("/admin/green-tokens/settlement-all", {
    method: "POST",
    body: {
      month: payload.month ?? null,
    },
  });
}

export function getUserTransactionHistory(payload: { userId?: string; tokenType?: string; limit?: number } = {}) {
  const params = new URLSearchParams();

  if (payload.userId) {
    params.set("user_id", payload.userId);
  }

  if (payload.tokenType) {
    params.set("token_type", payload.tokenType);
  }

  if (typeof payload.limit === "number" && Number.isFinite(payload.limit)) {
    params.set("limit", String(payload.limit));
  }

  const query = params.toString();
  return serverApiRequest<UserTransactionHistoryResponse>(`/transactions/history${query ? `?${query}` : ""}`);
}

export function searchMarketplaceSellers(query: string) {
  const params = new URLSearchParams();
  params.set("q", query);
  return serverApiRequest<MarketplaceSellerOption[]>(`/green-tokens/sellers/search?${params.toString()}`);
}

export function searchTransferRecipients(query: string) {
  const params = new URLSearchParams();
  params.set("q", query);
  return serverApiRequest<PublicUserRow[]>(`/users/search?${params.toString()}`);
}
