import { supabase } from "./supabase";

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  language: "en" | "fr" | "cr";
  role: "user" | "admin" | "superadmin";
  user_type: "consumer" | "producer" | "prosumer";
  status: "active" | "inactive" | "suspended";
  avatar_url: string | null;
  created_by?: string | null;
};

export type UserType = "consumer" | "producer" | "prosumer";

export type UserSettingsRow = {
  user_id: string;
  email_notifications: boolean;
  push_notifications: boolean;
  transaction_alerts: boolean;
  mfa_enabled: boolean;
};

export type WalletRow = {
  user_id: string;
  balance?: number | null;
  lifetime_earned: number;
  lifetime_spent: number;
  yellow_token?: number;
  red_token?: number;
  green_token?: number;
  updated_at: string;
};

export type WalletTransactionRow = {
  id: string;
  user_id: string;
  counterparty_user_id: string | null;
  transaction_type: "earn" | "send" | "receive" | "adjustment";
  amount: number;
  description: string;
  status: "pending" | "completed" | "failed";
  created_at: string;
};

export type EnergyReadingRow = {
  id: string;
  user_id: string;
  reading_date: string;
  imported_kwh: number;
  exported_kwh: number;
  tokens_earned: number;
  notes: string | null;
  created_at: string;
};

export type PublicUserRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email?: string | null;
};

export type AdminOverviewRow = {
  total_users: number;
  total_tokens: number;
  total_imported_kwh: number;
  total_exported_kwh: number;
  total_red_coins: number;
  total_yellow_coins: number;
  total_green_coins: number;
};

export type UserWalletSummaryRow = {
  user_id: string;
  full_name: string | null;
  language: "en" | "fr" | "cr";
  role: "user" | "admin" | "superadmin";
  user_type: UserType;
  status: "active" | "inactive" | "suspended";
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  total_imported_kwh: number;
  total_exported_kwh: number;
  red_coins: number;
  yellow_coins: number;
  green_coins: number;
  bill_estimate: number;
};

export type UserPortalSummaryRow = {
  user_id: string;
  full_name: string | null;
  language: "en" | "fr" | "cr";
  role: "user" | "admin" | "superadmin";
  user_type: UserType;
  status: "active" | "inactive" | "suspended";
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  total_imported_kwh: number;
  total_exported_kwh: number;
  net_energy_kwh: number;
  red_coins: number;
  yellow_coins: number;
  green_coins: number;
  green_coin_total_cost: number;
  bill_estimate: number;
};

export type GreenCoinPurchaseRow = {
  id: string;
  user_id: string;
  green_coins: number;
  unit_price: number;
  total_cost: number;
  status: "pending" | "completed" | "failed";
  payment_reference: string | null;
  created_at: string;
};

export type CoinSettingsRow = {
  id: true;
  red_coin_rate: number;
  yellow_coin_rate: number;
  yellow_coin_bill_offset_rate: number;
  green_coin_unit_price: number;
  green_coin_bill_offset_rate: number;
  updated_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  notification_type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export type EnergyImportAdminRow = {
  id: string;
  source_file_name: string;
  dataset_user_code: string;
  dataset_user_type: UserType;
  meter_id: string;
  billing_cycle: number;
  reading_date: string | null;
  period_start: string | null;
  period_end: string | null;
  imported_kwh: number;
  exported_kwh: number;
  net_kwh: number | null;
  tokens_earned: number | null;
  yellow_tokens: number | null;
  red_tokens: number | null;
  green_cap_kwh: number | null;
  green_purchased_kwh: number | null;
  remaining_green_cap_kwh: number | null;
  settlement_required_kwh: number | null;
  estimated_bill: number | null;
  processing_status: "pending" | "processing" | "calculated" | "promoted" | "failed";
  calculation_version: string | null;
  processing_error: string | null;
  calculated_at: string | null;
  promoted_at: string | null;
  linked_user_id: string | null;
  linked_user_name: string | null;
  linked_user_email: string | null;
};

export type DatasetUserMappingRow = {
  dataset_user_code: string;
  dataset_user_type: UserType;
  linked_user_id: string;
  source_file_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminProfileOptionRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role?: "user" | "admin" | "superadmin";
  user_type: UserType;
  status: "active" | "inactive" | "suspended";
};

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

async function requireCurrentUserId() {
  const client = requireSupabase();
  const {
    data: { session },
    error,
  } = await client.auth.getSession();

  if (error) {
    throw error;
  }

  const user = session?.user ?? null;

  if (!user) {
    throw new Error("Authentication required.");
  }

  return user.id;
}

export async function getProfileByUserId(userId: string) {
  const client = requireSupabase();
  const { data, error } = await client.from("profiles").select("*").eq("id", userId).maybeSingle();

  if (error) {
    throw error;
  }

  return data as ProfileRow | null;
}

export async function getMyProfile() {
  const userId = await requireCurrentUserId();
  return getProfileByUserId(userId);
}

async function requireCurrentProfile() {
  const profile = await getMyProfile();

  if (!profile) {
    throw new Error("Profile not found for the authenticated user.");
  }

  return profile;
}

async function requireStaffProfile() {
  const profile = await requireCurrentProfile();

  if (profile.role !== "admin" && profile.role !== "superadmin") {
    throw new Error("Staff access required.");
  }

  if (profile.status !== "active") {
    throw new Error("Your staff account is not active.");
  }

  return profile;
}

async function requireSuperAdminProfile() {
  const profile = await requireCurrentProfile();

  if (profile.role !== "superadmin") {
    throw new Error("Super admin access required.");
  }

  if (profile.status !== "active") {
    throw new Error("Your super admin account is not active.");
  }

  return profile;
}

export async function updateMyProfile(values: Partial<Pick<ProfileRow, "full_name" | "phone" | "language" | "avatar_url">>) {
  const client = requireSupabase();
  const userId = await requireCurrentUserId();
  const { data, error } = await client.from("profiles").update(values).eq("id", userId).select("*").maybeSingle();

  if (error) {
    throw error;
  }

  return data as ProfileRow | null;
}

export async function getMySettings() {
  const client = requireSupabase();
  const userId = await requireCurrentUserId();
  const { data, error } = await client
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as UserSettingsRow | null;
}

export async function updateMySettings(values: Partial<Omit<UserSettingsRow, "user_id">>) {
  const client = requireSupabase();
  const userId = await requireCurrentUserId();
  const { data, error } = await client
    .from("user_settings")
    .update(values)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as UserSettingsRow | null;
}

export async function getMyWallet() {
  const client = requireSupabase();
  const userId = await requireCurrentUserId();
  const { data, error } = await client.from("wallets").select("*").eq("user_id", userId).maybeSingle();

  if (error) {
    throw error;
  }

  return data as WalletRow | null;
}

export async function getMyPortalSummary() {
  const client = requireSupabase();
  const userId = await requireCurrentUserId();
  const { data, error } = await client
    .from("user_portal_summary")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as UserPortalSummaryRow | null;
}

export async function getMyTransactions(limit = 20) {
  const client = requireSupabase();
  const userId = await requireCurrentUserId();
  const { data, error } = await client
    .from("wallet_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as WalletTransactionRow[];
}

export async function getMyEnergyReadings(limit = 30) {
  const client = requireSupabase();
  const userId = await requireCurrentUserId();
  const { data, error } = await client
    .from("energy_readings")
    .select("*")
    .eq("user_id", userId)
    .order("reading_date", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as EnergyReadingRow[];
}

export async function getMyGreenCoinPurchases(limit = 20) {
  const client = requireSupabase();
  const userId = await requireCurrentUserId();
  const { data, error } = await client
    .from("green_coin_purchases")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as GreenCoinPurchaseRow[];
}

export async function searchUsers(search: string) {
  const client = requireSupabase();
  const term = search.trim();
  const userId = await requireCurrentUserId();

  if (!term) {
    return [];
  }

  const { data, error } = await client
    .from("public_user_directory")
    .select("id, full_name, avatar_url, email")
    .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
    .neq("id", userId)
    .limit(10);

  if (error) {
    throw error;
  }

  return (data ?? []) as PublicUserRow[];
}

export async function transferTokens(receiverId: string, amount: number, description?: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("transfer_tokens", {
    receiver_id: receiverId,
    transfer_amount: amount,
    transfer_description: description ?? null,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function recordEnergyReading(targetDate: string, imported: number, exported: number, notes?: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("record_energy_reading", {
    target_date: targetDate,
    imported,
    exported,
    notes_input: notes ?? null,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function getCoinSettings() {
  const client = requireSupabase();
  const { data, error } = await client.from("coin_settings").select("*").eq("id", true).maybeSingle();

  if (error) {
    throw error;
  }

  return data as CoinSettingsRow | null;
}

export async function updateCoinSettings(values: Partial<Omit<CoinSettingsRow, "id" | "updated_at">>) {
  const client = requireSupabase();
  await requireStaffProfile();
  const { data, error } = await client
    .from("coin_settings")
    .update(values)
    .eq("id", true)
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data as CoinSettingsRow | null;
  }

  const existing = await getCoinSettings();

  if (!existing) {
    throw new Error("Coin settings row was not found.");
  }

  return existing;
}

export async function purchaseGreenCoins(amount: number, paymentReference?: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("purchase_green_coins", {
    purchase_amount: amount,
    payment_reference_input: paymentReference ?? null,
  });

  if (error) {
    throw error;
  }

  return data as GreenCoinPurchaseRow;
}

export async function getAdminOverview() {
  const client = requireSupabase();
  await requireStaffProfile();
  const { data, error } = await client.from("admin_overview").select("*").maybeSingle();

  if (error) {
    throw error;
  }

  return data as AdminOverviewRow | null;
}

export async function getAdminUsers(limit = 10) {
  const client = requireSupabase();
  await requireStaffProfile();
  const { data, error } = await client
    .from("user_wallet_summary")
    .select("*")
    .order("balance", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as UserWalletSummaryRow[];
}

export async function getAdminPurchases(limit = 20) {
  const client = requireSupabase();
  await requireStaffProfile();
  const { data, error } = await client
    .from("green_coin_purchases")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as GreenCoinPurchaseRow[];
}

export async function getRecentTransactions(limit = 10) {
  const client = requireSupabase();
  await requireStaffProfile();
  const { data, error } = await client
    .from("wallet_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as WalletTransactionRow[];
}

export async function getNotifications(limit = 10) {
  const client = requireSupabase();
  await requireStaffProfile();
  const { data, error } = await client
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as NotificationRow[];
}

export async function getEnergyImportAdminRows(limit = 100) {
  const client = requireSupabase();
  await requireStaffProfile();
  const { data, error } = await client
    .from("energy_import_admin_view")
    .select("*")
    .order("dataset_user_code", { ascending: true })
    .order("billing_cycle", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as EnergyImportAdminRow[];
}

export async function getDatasetUserMappings() {
  const client = requireSupabase();
  await requireStaffProfile();
  const { data, error } = await client
    .from("dataset_user_mappings")
    .select("*")
    .order("dataset_user_code", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as DatasetUserMappingRow[];
}

export async function getAdminProfileOptions(limit = 100) {
  const client = requireSupabase();
  await requireStaffProfile();
  const { data, error } = await client
    .from("profiles")
    .select("id, full_name, email, role, user_type, status")
    .eq("status", "active")
    .order("full_name", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as AdminProfileOptionRow[];
}

export async function applyDatasetUserMapping(
  datasetUserCode: string,
  linkedUserId: string,
  options?: {
    datasetUserType?: UserType;
    sourceFileName?: string | null;
    notes?: string | null;
  },
) {
  const client = requireSupabase();
  await requireStaffProfile();
  const { data, error } = await client.rpc("apply_dataset_user_mapping", {
    dataset_code: datasetUserCode,
    profile_id: linkedUserId,
    dataset_type: options?.datasetUserType ?? null,
    source_file: options?.sourceFileName ?? null,
    mapping_notes: options?.notes ?? null,
  });

  if (error) {
    throw error;
  }

  return data as DatasetUserMappingRow;
}

export async function getManagedProfilesByRole(roles: Array<ProfileRow["role"]>, limit = 100) {
  const client = requireSupabase();
  await requireSuperAdminProfile();
  const { data, error } = await client
    .from("profiles")
    .select("id, email, full_name, role, user_type, status, language, created_by")
    .in("role", roles)
    .order("full_name", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as ProfileRow[];
}
