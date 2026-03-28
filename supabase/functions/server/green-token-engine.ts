import { createAdminClient } from "./supabase.ts";

type AdminClient = ReturnType<typeof createAdminClient>;

type WalletRow = {
  user_id: string;
  balance: number | null;
  lifetime_earned: number | null;
  lifetime_spent: number | null;
  yellow_token: number | null;
  red_token: number | null;
  green_token: number | null;
  updated_at: string | null;
};

type TransactionRow = {
  id: string;
  user_id: string;
  counterparty_user_id: string | null;
  transaction_type: "earn" | "send" | "receive" | "adjustment";
  amount: number;
  description: string;
  status: "pending" | "completed" | "failed";
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type PurchaseRequestRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  amount_rs: number;
  yellow_amount: number;
  green_amount: number;
  status: "pending" | "accepted" | "rejected" | "expired" | "completed";
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  completed_at: string | null;
  notes: string | null;
};

type TradeProfile = {
  id: string;
  user_type: "consumer" | "producer" | "prosumer";
  status: "active" | "inactive" | "suspended";
};

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function utcNowIso() {
  return new Date().toISOString();
}

function normalizeMonth(month?: string | null) {
  if (!month) {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return {
      monthStart: start,
      nextMonthStart: next,
      label: start.toISOString().slice(0, 7),
    };
  }

  const normalized = /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : month;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("month must be YYYY-MM or YYYY-MM-DD");
  }

  const start = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
  const next = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 1));

  return {
    monthStart: start,
    nextMonthStart: next,
    label: start.toISOString().slice(0, 7),
  };
}

function serializeWallet(wallet: WalletRow | null) {
  const yellow = round2(numeric(wallet?.yellow_token));
  const red = round2(numeric(wallet?.red_token));
  const green = round2(numeric(wallet?.green_token));
  const balance = round2(
    wallet?.balance != null ? numeric(wallet.balance) : Math.max(yellow + green - red, 0),
  );

  return {
    user_id: wallet?.user_id ?? "",
    yellow_token: yellow,
    red_token: red,
    green_token: green,
    yellow_balance: yellow,
    red_balance: red,
    green_balance: green,
    balance,
    updated_at: wallet?.updated_at ?? utcNowIso(),
  };
}

async function userExists(admin: AdminClient, userId: string) {
  const { data, error } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data?.id);
}

async function fetchTradeProfile(admin: AdminClient, userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("id, user_type, status")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as TradeProfile | null) ?? null;
}

async function ensureWalletExists(admin: AdminClient, userId: string) {
  const { data, error } = await admin
    .from("wallets")
    .select("user_id, balance, lifetime_earned, lifetime_spent, yellow_token, red_token, green_token, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    return data as WalletRow;
  }

  const insertResult = await admin
    .from("wallets")
    .insert({
      user_id: userId,
      balance: 0,
      lifetime_earned: 0,
      lifetime_spent: 0,
      yellow_token: 0,
      red_token: 0,
      green_token: 0,
      updated_at: utcNowIso(),
    })
    .select("user_id, balance, lifetime_earned, lifetime_spent, yellow_token, red_token, green_token, updated_at")
    .maybeSingle();

  if (insertResult.error || !insertResult.data) {
    throw new Error(insertResult.error?.message ?? "Unable to create wallet.");
  }

  return insertResult.data as WalletRow;
}

async function updateWallet(admin: AdminClient, userId: string, nextWallet: Partial<WalletRow>) {
  const { data, error } = await admin
    .from("wallets")
    .update({
      ...nextWallet,
      updated_at: utcNowIso(),
    })
    .eq("user_id", userId)
    .select("user_id, balance, lifetime_earned, lifetime_spent, yellow_token, red_token, green_token, updated_at")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to update wallet.");
  }

  return data as WalletRow;
}

async function fetchBuyerMeterId(admin: AdminClient, buyerId: string) {
  const { data, error } = await admin
    .from("energy_readings_import")
    .select("meter_id")
    .eq("linked_user_id", buyerId)
    .not("meter_id", "is", null)
    .order("billing_cycle", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return typeof data?.meter_id === "string" ? data.meter_id : null;
}

async function calculateGreenCap(admin: AdminClient, buyerId: string, meterId: string) {
  const { data, error } = await admin
    .from("energy_readings_import")
    .select("imported_kwh")
    .eq("linked_user_id", buyerId)
    .eq("meter_id", meterId)
    .order("billing_cycle", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) {
    throw new Error(error.message);
  }

  const imports = (data ?? [])
    .map((row) => numeric(row.imported_kwh))
    .filter((value) => value > 0);

  if (imports.length === 0) {
    return 0;
  }

  return round2(imports.reduce((sum, value) => sum + value, 0) / imports.length / 2);
}

async function getMonthlyGreenPurchases(admin: AdminClient, userId: string, month?: string | null) {
  const { monthStart, nextMonthStart } = normalizeMonth(month);
  const { data, error } = await admin
    .from("green_coin_purchases")
    .select("green_coins")
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("created_at", monthStart.toISOString())
    .lt("created_at", nextMonthStart.toISOString());

  if (error) {
    throw new Error(error.message);
  }

  return round2((data ?? []).reduce((sum, row) => sum + numeric(row.green_coins), 0));
}

async function fetchPurchaseRequest(admin: AdminClient, requestId: string) {
  const { data, error } = await admin
    .from("green_purchase_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as PurchaseRequestRow | null) ?? null;
}

async function fetchProfileMap(admin: AdminClient, userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map<string, { id: string; name: string | null; email: string | null }>();
  }

  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", uniqueIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    (data ?? []).map((row) => [
      row.id,
      {
        id: row.id,
        name: row.full_name ?? null,
        email: row.email ?? null,
      },
    ]),
  );
}

function enrichPurchaseRequest(
  request: PurchaseRequestRow,
  profileMap: Map<string, { id: string; name: string | null; email: string | null }>,
  userId?: string,
) {
  let role: "buyer" | "seller" | null = null;
  let counterpartyId: string | null = null;

  if (userId) {
    if (request.buyer_id === userId) {
      role = "buyer";
      counterpartyId = request.seller_id;
    } else if (request.seller_id === userId) {
      role = "seller";
      counterpartyId = request.buyer_id;
    }
  }

  return {
    ...request,
    buyer: profileMap.get(request.buyer_id) ?? null,
    seller: profileMap.get(request.seller_id) ?? null,
    role,
    counterparty: counterpartyId ? profileMap.get(counterpartyId) ?? null : null,
  };
}

export async function createGreenPurchaseRequest(
  admin: AdminClient,
  buyerId: string,
  sellerId: string,
  amountRs: number,
) {
  if (!buyerId || !sellerId) {
    return { success: false, error: "buyer_id and seller_id are required" };
  }

  if (buyerId === sellerId) {
    return { success: false, error: "buyer_id and seller_id must be different" };
  }

  if (!Number.isFinite(amountRs) || amountRs <= 0) {
    return { success: false, error: "amount_rs must be greater than 0" };
  }

  const buyerProfile = await fetchTradeProfile(admin, buyerId);
  const sellerProfile = await fetchTradeProfile(admin, sellerId);

  if (!buyerProfile) {
    return { success: false, error: "Buyer not found", buyer_id: buyerId };
  }

  if (!sellerProfile) {
    return { success: false, error: "Seller not found", seller_id: sellerId };
  }

  if (buyerProfile.status !== "active") {
    return { success: false, error: "Buyer account is not active", buyer_id: buyerId };
  }

  if (sellerProfile.status !== "active") {
    return { success: false, error: "Seller account is not active", seller_id: sellerId };
  }

  if (buyerProfile.user_type === "producer") {
    return { success: false, error: "Producer accounts cannot create green coin purchase requests" };
  }

  if (sellerProfile.user_type === "consumer") {
    return { success: false, error: "Consumer accounts cannot sell green coins" };
  }

  const roundedAmountRs = round2(amountRs);
  const yellowAmount = roundedAmountRs;
  const greenAmount = round2(roundedAmountRs / 2);

  const buyerMeterId = await fetchBuyerMeterId(admin, buyerId);
  if (!buyerMeterId) {
    return { success: false, error: "Buyer meter not found", buyer_id: buyerId };
  }

  const buyerCap = await calculateGreenCap(admin, buyerId, buyerMeterId);
  const existingPurchases = await getMonthlyGreenPurchases(admin, buyerId);

  if (round2(existingPurchases + greenAmount) > buyerCap) {
    return {
      success: false,
      error: "Purchase exceeds green cap",
      cap_limit: buyerCap,
      existing: existingPurchases,
      requested: greenAmount,
      available: Math.max(0, round2(buyerCap - existingPurchases)),
    };
  }

  const insertResult = await admin
    .from("green_purchase_requests")
    .insert({
      buyer_id: buyerId,
      seller_id: sellerId,
      amount_rs: roundedAmountRs,
      yellow_amount: yellowAmount,
      green_amount: greenAmount,
      status: "pending",
      created_at: utcNowIso(),
    })
    .select("*")
    .maybeSingle();

  if (insertResult.error || !insertResult.data) {
    throw new Error(insertResult.error?.message ?? "Unable to create purchase request.");
  }

  return {
    success: true,
    request_id: insertResult.data.id,
    buyer_id: buyerId,
    seller_id: sellerId,
    amount_rs: roundedAmountRs,
    yellow_amount: yellowAmount,
    green_amount: greenAmount,
    status: insertResult.data.status,
    cap_status: {
      limit: buyerCap,
      existing: existingPurchases,
      requested: greenAmount,
      available: Math.max(0, round2(buyerCap - existingPurchases)),
      remaining: Math.max(0, round2(buyerCap - existingPurchases - greenAmount)),
    },
  };
}

export async function acceptGreenPurchaseRequest(admin: AdminClient, requestId: string, sellerId: string) {
  if (!requestId || !sellerId) {
    return { success: false, error: "request_id and seller_id are required" };
  }

  const request = await fetchPurchaseRequest(admin, requestId);
  if (!request) {
    return { success: false, error: "Purchase request not found", request_id: requestId };
  }

  if (request.status !== "pending") {
    return {
      success: false,
      error: "Purchase request is not pending",
      request_id: requestId,
      status: request.status,
    };
  }

  if (request.seller_id !== sellerId) {
    return {
      success: false,
      error: "seller_id does not match request seller",
      request_id: requestId,
      seller_id: sellerId,
    };
  }

  const sellerProfile = await fetchTradeProfile(admin, sellerId);
  if (!sellerProfile) {
    return { success: false, error: "Seller not found", seller_id: sellerId };
  }

  if (sellerProfile.status !== "active") {
    return { success: false, error: "Seller account is not active", seller_id: sellerId };
  }

  if (sellerProfile.user_type === "consumer") {
    return { success: false, error: "Consumer accounts cannot accept sell requests" };
  }

  const sellerWallet = await ensureWalletExists(admin, sellerId);
  if (numeric(sellerWallet.yellow_token) < numeric(request.yellow_amount)) {
    return {
      success: false,
      error: "Seller has insufficient yellow balance",
      seller_balance: round2(numeric(sellerWallet.yellow_token)),
      required_amount: round2(numeric(request.yellow_amount)),
      request_id: requestId,
    };
  }

  const execution = await purchaseGreenTokensP2P(admin, request.buyer_id, sellerId, numeric(request.amount_rs));
  if (!execution.success) {
    return {
      ...execution,
      request_id: requestId,
      seller_balance:
        typeof execution.yellow_available === "number" ? round2(execution.yellow_available) : undefined,
      required_amount:
        typeof execution.yellow_required === "number" ? round2(execution.yellow_required) : undefined,
    };
  }

  const updateResult = await admin
    .from("green_purchase_requests")
    .update({
      status: "completed",
      accepted_at: utcNowIso(),
      completed_at: utcNowIso(),
      updated_at: utcNowIso(),
    })
    .eq("id", requestId)
    .select("*")
    .maybeSingle();

  if (updateResult.error || !updateResult.data) {
    throw new Error(updateResult.error?.message ?? "Unable to mark purchase request completed.");
  }

  return {
    success: true,
    request_id: requestId,
    buyer_id: request.buyer_id,
    seller_id: sellerId,
    amount_rs: round2(numeric(request.amount_rs)),
    yellow_deducted: round2(numeric(request.yellow_amount)),
    green_added: round2(numeric(request.green_amount)),
    buyer_balances: execution.buyer_balances,
    seller_balances: execution.seller_balances,
    transaction_record: execution.transaction_record,
    green_purchase_record: execution.green_purchase_record,
  };
}

export async function rejectGreenPurchaseRequest(
  admin: AdminClient,
  requestId: string,
  sellerId: string,
  reason?: string | null,
) {
  if (!requestId || !sellerId) {
    return { success: false, error: "request_id and seller_id are required" };
  }

  const request = await fetchPurchaseRequest(admin, requestId);
  if (!request) {
    return { success: false, error: "Purchase request not found", request_id: requestId };
  }

  if (request.status !== "pending") {
    return {
      success: false,
      error: "Purchase request is not pending",
      request_id: requestId,
      status: request.status,
    };
  }

  if (request.seller_id !== sellerId) {
    return {
      success: false,
      error: "seller_id does not match request seller",
      request_id: requestId,
      seller_id: sellerId,
    };
  }

  const sellerProfile = await fetchTradeProfile(admin, sellerId);
  if (!sellerProfile) {
    return { success: false, error: "Seller not found", seller_id: sellerId };
  }

  if (sellerProfile.status !== "active") {
    return { success: false, error: "Seller account is not active", seller_id: sellerId };
  }

  if (sellerProfile.user_type === "consumer") {
    return { success: false, error: "Consumer accounts cannot reject sell requests" };
  }

  const updateResult = await admin
    .from("green_purchase_requests")
    .update({
      status: "rejected",
      rejected_at: utcNowIso(),
      notes: reason ?? null,
      updated_at: utcNowIso(),
    })
    .eq("id", requestId)
    .select("*")
    .maybeSingle();

  if (updateResult.error || !updateResult.data) {
    throw new Error(updateResult.error?.message ?? "Unable to reject purchase request.");
  }

  return {
    success: true,
    request_id: requestId,
    status: "rejected",
    buyer_id: request.buyer_id,
    seller_id: sellerId,
    message: "Purchase request rejected",
  };
}

export async function getPendingPurchaseRequests(
  admin: AdminClient,
  userId: string,
  asSeller = true,
) {
  if (!userId) {
    return { success: false, error: "user_id is required" };
  }

  if (!(await userExists(admin, userId))) {
    return { success: false, error: "User not found", user_id: userId };
  }

  const column = asSeller ? "seller_id" : "buyer_id";
  const { data, error } = await admin
    .from("green_purchase_requests")
    .select("*")
    .eq(column, userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const requestRows = (data ?? []) as PurchaseRequestRow[];
  const profileMap = await fetchProfileMap(
    admin,
    requestRows.map((row) => (asSeller ? row.buyer_id : row.seller_id)),
  );

  return {
    success: true,
    user_id: userId,
    as_seller: asSeller,
    total_pending: requestRows.length,
    requests: requestRows.map((row) => ({
      ...row,
      counterparty: profileMap.get(asSeller ? row.buyer_id : row.seller_id) ?? null,
    })),
  };
}

export async function getPurchaseRequestHistory(
  admin: AdminClient,
  userId: string,
  statusFilter?: string | null,
  limit = 50,
) {
  if (!userId) {
    return { success: false, error: "user_id is required" };
  }

  if (!(await userExists(admin, userId))) {
    return { success: false, error: "User not found", user_id: userId };
  }

  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  let query = admin
    .from("green_purchase_requests")
    .select("*")
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("updated_at", { ascending: false })
    .limit(safeLimit);

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const requestRows = (data ?? []) as PurchaseRequestRow[];
  const profileMap = await fetchProfileMap(
    admin,
    requestRows.flatMap((row) => [row.buyer_id, row.seller_id]),
  );

  return {
    success: true,
    user_id: userId,
    total: requestRows.length,
    requests: requestRows.map((row) => enrichPurchaseRequest(row, profileMap, userId)),
  };
}

export async function purchaseGreenTokensP2P(admin: AdminClient, buyerId: string, sellerId: string, amountRs: number) {
  if (!buyerId || !sellerId) {
    return { success: false, error: "buyer_id and seller_id are required" };
  }

  if (buyerId === sellerId) {
    return { success: false, error: "buyer_id and seller_id must be different" };
  }

  if (!Number.isFinite(amountRs) || amountRs <= 0) {
    return { success: false, error: "amount_rs must be greater than 0" };
  }

  const buyerProfile = await fetchTradeProfile(admin, buyerId);
  const sellerProfile = await fetchTradeProfile(admin, sellerId);

  if (!buyerProfile) {
    return { success: false, error: "Buyer not found", buyer_id: buyerId };
  }

  if (!sellerProfile) {
    return { success: false, error: "Seller not found", seller_id: sellerId };
  }

  if (buyerProfile.status !== "active") {
    return { success: false, error: "Buyer account is not active", buyer_id: buyerId };
  }

  if (sellerProfile.status !== "active") {
    return { success: false, error: "Seller account is not active", seller_id: sellerId };
  }

  if (buyerProfile.user_type === "producer") {
    return { success: false, error: "Producer accounts cannot buy green coins" };
  }

  if (sellerProfile.user_type === "consumer") {
    return { success: false, error: "Consumer accounts cannot sell green coins" };
  }

  const roundedAmountRs = round2(amountRs);
  const yellowAmount = roundedAmountRs;
  const greenTokensReceived = round2(roundedAmountRs / 2);
  const monthInfo = normalizeMonth();

  const buyerMeterId = await fetchBuyerMeterId(admin, buyerId);
  if (!buyerMeterId) {
    return { success: false, error: "Buyer meter not found", buyer_id: buyerId };
  }

  const buyerCap = await calculateGreenCap(admin, buyerId, buyerMeterId);
  const existingPurchases = await getMonthlyGreenPurchases(admin, buyerId, monthInfo.label);
  const totalAfterPurchase = round2(existingPurchases + greenTokensReceived);

  if (totalAfterPurchase > buyerCap) {
    return {
      success: false,
      error: "Purchase exceeds green cap",
      cap_limit: buyerCap,
      existing_purchases: existingPurchases,
      requested: greenTokensReceived,
      available: Math.max(0, round2(buyerCap - existingPurchases)),
    };
  }

  const buyerWallet = await ensureWalletExists(admin, buyerId);
  const sellerWallet = await ensureWalletExists(admin, sellerId);

  if (numeric(sellerWallet.yellow_token) < yellowAmount) {
    return {
      success: false,
      error: "Seller has insufficient yellow balance",
      seller_id: sellerId,
      yellow_required: yellowAmount,
      yellow_available: round2(numeric(sellerWallet.yellow_token)),
    };
  }

  const sellerBefore = { ...sellerWallet };
  const buyerBefore = { ...buyerWallet };
  let updatedSeller: WalletRow | null = null;
  let updatedBuyer: WalletRow | null = null;
  let purchaseId: string | null = null;

  try {
    updatedSeller = await updateWallet(admin, sellerId, {
      yellow_token: round2(numeric(sellerWallet.yellow_token) - yellowAmount),
      balance: round2(
        Math.max(
          numeric(sellerWallet.yellow_token) - yellowAmount + numeric(sellerWallet.green_token) - numeric(sellerWallet.red_token),
          0,
        ),
      ),
      lifetime_spent: round2(numeric(sellerWallet.lifetime_spent) + yellowAmount),
    });

    updatedBuyer = await updateWallet(admin, buyerId, {
      green_token: round2(numeric(buyerWallet.green_token) + greenTokensReceived),
      balance: round2(
        Math.max(
          numeric(buyerWallet.yellow_token) + numeric(buyerWallet.green_token) + greenTokensReceived - numeric(buyerWallet.red_token),
          0,
        ),
      ),
      lifetime_earned: round2(numeric(buyerWallet.lifetime_earned) + greenTokensReceived),
    });

    const purchaseResult = await admin
      .from("green_coin_purchases")
      .insert({
        user_id: buyerId,
        green_coins: greenTokensReceived,
        unit_price: round2(roundedAmountRs / greenTokensReceived),
        total_cost: roundedAmountRs,
        status: "completed",
        payment_reference: null,
      })
      .select("*")
      .maybeSingle();

    if (purchaseResult.error || !purchaseResult.data) {
      throw new Error(purchaseResult.error?.message ?? "Unable to record green purchase.");
    }

    purchaseId = purchaseResult.data.id;
    const transferGroupId = crypto.randomUUID();
    const metadata = {
      token_type: "green_purchase",
      amount: greenTokensReceived,
      amount_rs: roundedAmountRs,
      yellow_deducted_from_seller: yellowAmount,
      green_added_to_buyer: greenTokensReceived,
      transfer_group_id: transferGroupId,
      sender_id: sellerId,
      receiver_id: buyerId,
      purchase_id: purchaseId,
      month: monthInfo.label,
    };

    const txResult = await admin.from("wallet_transactions").insert([
      {
        user_id: sellerId,
        counterparty_user_id: buyerId,
        transaction_type: "send",
        amount: greenTokensReceived * -1,
        description: "Peer green token purchase",
        status: "completed",
        metadata,
      },
      {
        user_id: buyerId,
        counterparty_user_id: sellerId,
        transaction_type: "receive",
        amount: greenTokensReceived,
        description: "Peer green token purchase",
        status: "completed",
        metadata,
      },
    ]).select("*");

    if (txResult.error) {
      throw new Error(txResult.error.message);
    }

    const records = (txResult.data ?? []) as TransactionRow[];
    const senderRecord = records.find((row) => row.user_id === sellerId) ?? null;
    const receiverRecord = records.find((row) => row.user_id === buyerId) ?? null;

    return {
      success: true,
      buyer_id: buyerId,
      seller_id: sellerId,
      amount_rs: roundedAmountRs,
      yellow_deducted_from_seller: yellowAmount,
      green_added_to_buyer: greenTokensReceived,
      buyer_balances: serializeWallet(updatedBuyer),
      seller_balances: serializeWallet(updatedSeller),
      transaction_record: {
        sender_record: senderRecord,
        receiver_record: receiverRecord,
      },
      green_purchase_record: {
        ...purchaseResult.data,
        month: monthInfo.label,
        green_purchased: greenTokensReceived,
        kwh_covered: greenTokensReceived,
        amount_rs: roundedAmountRs,
      },
      cap_status: {
        limit: buyerCap,
        existing: existingPurchases,
        requested: greenTokensReceived,
        remaining: Math.max(0, round2(buyerCap - totalAfterPurchase)),
      },
    };
  } catch (error) {
    if (purchaseId) {
      await admin.from("green_coin_purchases").delete().eq("id", purchaseId);
    }

    if (updatedBuyer) {
      await updateWallet(admin, buyerId, {
        yellow_token: numeric(buyerBefore.yellow_token),
        red_token: numeric(buyerBefore.red_token),
        green_token: numeric(buyerBefore.green_token),
        balance: numeric(buyerBefore.balance),
        lifetime_earned: numeric(buyerBefore.lifetime_earned),
        lifetime_spent: numeric(buyerBefore.lifetime_spent),
      });
    }

    if (updatedSeller) {
      await updateWallet(admin, sellerId, {
        yellow_token: numeric(sellerBefore.yellow_token),
        red_token: numeric(sellerBefore.red_token),
        green_token: numeric(sellerBefore.green_token),
        balance: numeric(sellerBefore.balance),
        lifetime_earned: numeric(sellerBefore.lifetime_earned),
        lifetime_spent: numeric(sellerBefore.lifetime_spent),
      });
    }

    throw error;
  }
}

export async function processEndOfMonthSettlement(admin: AdminClient, userId: string, month?: string | null) {
  if (!userId) {
    return { success: false, error: "user_id is required" };
  }

  if (!(await userExists(admin, userId))) {
    return { success: false, error: "User not found", user_id: userId };
  }

  const monthInfo = normalizeMonth(month);
  const currentWallet = await ensureWalletExists(admin, userId);
  const redBefore = round2(numeric(currentWallet.red_token));
  const greenBefore = round2(numeric(currentWallet.green_token));

  if (redBefore <= 0 || greenBefore <= 0) {
    return {
      success: true,
      user_id: userId,
      month: monthInfo.label,
      green_used: 0,
      red_before: redBefore,
      red_after: redBefore,
      green_before: greenBefore,
      green_after: greenBefore,
      settlement_record: null,
      message: "No settlement needed",
    };
  }

  const greenToUse = round2(Math.min(redBefore, greenBefore));
  const walletBefore = { ...currentWallet };
  let updatedWallet: WalletRow | null = null;

  try {
    updatedWallet = await updateWallet(admin, userId, {
      red_token: round2(redBefore - greenToUse),
      green_token: round2(greenBefore - greenToUse),
      balance: round2(
        Math.max(
          numeric(currentWallet.yellow_token) + (greenBefore - greenToUse) - (redBefore - greenToUse),
          0,
        ),
      ),
      lifetime_spent: round2(numeric(currentWallet.lifetime_spent) + greenToUse),
    });

    const txResult = await admin
      .from("wallet_transactions")
      .insert({
        user_id: userId,
        counterparty_user_id: null,
        transaction_type: "adjustment",
        amount: greenToUse * -1,
        description: "Automatic monthly settlement",
        status: "completed",
        metadata: {
          token_type: "monthly_settlement",
          amount: greenToUse,
          amount_rs: round2(greenToUse * 2),
          sender_id: userId,
          receiver_id: null,
          month: monthInfo.label,
        },
      })
      .select("*")
      .maybeSingle();

    if (txResult.error || !txResult.data) {
      throw new Error(txResult.error?.message ?? "Unable to record monthly settlement.");
    }

    return {
      success: true,
      user_id: userId,
      month: monthInfo.label,
      green_used: greenToUse,
      red_before: redBefore,
      red_after: round2(numeric(updatedWallet.red_token)),
      green_before: greenBefore,
      green_after: round2(numeric(updatedWallet.green_token)),
      settlement_record: txResult.data,
    };
  } catch (error) {
    if (updatedWallet) {
      await updateWallet(admin, userId, {
        yellow_token: numeric(walletBefore.yellow_token),
        red_token: numeric(walletBefore.red_token),
        green_token: numeric(walletBefore.green_token),
        balance: numeric(walletBefore.balance),
        lifetime_earned: numeric(walletBefore.lifetime_earned),
        lifetime_spent: numeric(walletBefore.lifetime_spent),
      });
    }

    throw error;
  }
}

export async function processAllUsersEndOfMonth(admin: AdminClient, month?: string | null) {
  const monthInfo = normalizeMonth(month);
  const { data, error } = await admin.from("profiles").select("id").order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const results: Array<Record<string, unknown>> = [];
  const errors: Array<{ user_id?: string; error: string }> = [];
  let totalUsersProcessed = 0;
  let totalGreenUsed = 0;
  let totalRedRemaining = 0;

  for (const row of data ?? []) {
    try {
      const result = await processEndOfMonthSettlement(admin, row.id, monthInfo.label);
      results.push(result);

      if (result.success) {
        totalUsersProcessed += 1;
        totalGreenUsed = round2(totalGreenUsed + numeric(result.green_used));
        totalRedRemaining = round2(totalRedRemaining + numeric(result.red_after));
      } else {
        errors.push({ user_id: row.id, error: String(result.error ?? "Unknown error") });
      }
    } catch (error) {
      errors.push({ user_id: row.id, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  return {
    success: errors.length === 0,
    month: monthInfo.label,
    total_users_processed: totalUsersProcessed,
    total_green_used_across_all_users: totalGreenUsed,
    total_red_remaining_across_all_users: totalRedRemaining,
    results,
    errors,
  };
}

function normalizeTransaction(tx: TransactionRow) {
  const metadata = (tx.metadata ?? {}) as Record<string, unknown>;
  const tokenType = typeof metadata.token_type === "string" ? metadata.token_type : tx.transaction_type;
  const senderId =
    typeof metadata.sender_id === "string"
      ? metadata.sender_id
      : tx.transaction_type === "send"
        ? tx.user_id
        : tx.transaction_type === "receive"
          ? tx.counterparty_user_id
          : tx.user_id;
  const receiverId =
    typeof metadata.receiver_id === "string"
      ? metadata.receiver_id
      : tx.transaction_type === "send"
        ? tx.counterparty_user_id
        : tx.transaction_type === "receive"
          ? tx.user_id
          : tx.counterparty_user_id;

  return {
    id: tx.id,
    sender_id: senderId ?? null,
    receiver_id: receiverId ?? null,
    token_type: tokenType,
    amount: round2(
      typeof metadata.amount === "number" || typeof metadata.amount === "string"
        ? numeric(metadata.amount)
        : Math.abs(numeric(tx.amount)),
    ),
    amount_rs: round2(
      typeof metadata.amount_rs === "number" || typeof metadata.amount_rs === "string"
        ? numeric(metadata.amount_rs)
        : 0,
    ),
    description: tx.description,
    status: tx.status,
    created_at: tx.created_at,
    direction: "system" as "system" | "sent" | "received",
    note: null as string | null,
    event_key:
      typeof metadata.transfer_group_id === "string"
        ? metadata.transfer_group_id
        : [tokenType, senderId ?? "", receiverId ?? "", tx.created_at, Math.abs(numeric(tx.amount))].join("|"),
    preferred: tx.user_id,
  };
}

export async function getUserTransactionHistory(
  admin: AdminClient,
  userId: string,
  options: { tokenType?: string | null; limit?: number } = {},
) {
  if (!userId) {
    return { success: false, error: "user_id is required" };
  }

  if (!(await userExists(admin, userId))) {
    return { success: false, error: "User not found", user_id: userId };
  }

  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 50), 1), 100);
  const fetchLimit = Math.max(limit * 4, 100);

  const { data, error } = await admin
    .from("wallet_transactions")
    .select("id, user_id, counterparty_user_id, transaction_type, amount, description, status, metadata, created_at")
    .or(`user_id.eq.${userId},counterparty_user_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  if (error) {
    throw new Error(error.message);
  }

  const preferred = new Map<string, ReturnType<typeof normalizeTransaction>>();
  const fallback = new Map<string, ReturnType<typeof normalizeTransaction>>();

  for (const row of (data ?? []) as TransactionRow[]) {
    const normalized = normalizeTransaction(row);
    if (options.tokenType && normalized.token_type !== options.tokenType) {
      continue;
    }

    if (normalized.receiver_id == null) {
      normalized.direction = "system";
      normalized.note = "Automatic monthly settlement applied green tokens to red debt.";
    } else if (normalized.sender_id === userId) {
      normalized.direction = "sent";
    } else if (normalized.receiver_id === userId) {
      normalized.direction = "received";
    } else {
      normalized.direction = "system";
    }

    if (row.user_id === userId) {
      preferred.set(normalized.event_key, normalized);
    } else if (!preferred.has(normalized.event_key) && !fallback.has(normalized.event_key)) {
      fallback.set(normalized.event_key, normalized);
    }
  }

  const merged = [...preferred.values(), ...[...fallback.entries()].filter(([key]) => !preferred.has(key)).map(([, value]) => value)]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map(({ event_key: _eventKey, preferred: _preferred, ...item }) => item);

  return {
    success: true,
    user_id: userId,
    total_transactions: merged.length,
    transactions: merged,
  };
}
