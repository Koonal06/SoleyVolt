import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { runEnergyPipeline } from "./energy-pipeline.ts";
import {
  acceptGreenPurchaseRequest,
  createGreenPurchaseRequest,
  getPendingPurchaseRequests,
  getPurchaseRequestHistory,
  getUserTransactionHistory as getUserTransactionHistoryDirect,
  processAllUsersEndOfMonth as processAllUsersEndOfMonthDirect,
  processEndOfMonthSettlement as processEndOfMonthSettlementDirect,
  rejectGreenPurchaseRequest,
} from "./green-token-engine.ts";
import { createAdminClient, requireUser } from "./supabase.ts";

type Variables = {
  supabase: Awaited<ReturnType<typeof requireUser>>["client"];
  user: Awaited<ReturnType<typeof requireUser>>["user"];
};

type Language = "en" | "fr" | "cr";
type UserType = "consumer" | "producer" | "prosumer";
type ApplicationStatus = "pending" | "under_review" | "approved" | "rejected";
type StaffProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "user" | "admin" | "superadmin";
  status: "active" | "inactive" | "suspended";
};

const app = new Hono<{ Variables: Variables }>();

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return trimString(value).toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeNic(value: unknown) {
  return trimString(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isValidNic(value: string) {
  return /^[A-Z0-9]{14}$/.test(value);
}

function parseLanguage(value: unknown): Language {
  return value === "fr" || value === "cr" ? value : "en";
}

function parseRequestedUserType(value: unknown): UserType {
  return value === "consumer" || value === "producer" || value === "prosumer" ? value : "prosumer";
}

function parseApplicationStatus(value: unknown): ApplicationStatus | null {
  return value === "pending" || value === "under_review" || value === "approved" || value === "rejected"
    ? value
    : null;
}

function normalizeMonthInput(value: unknown) {
  const raw = trimString(value);

  if (!raw) {
    return null;
  }

  if (/^\d{4}-\d{2}$/.test(raw)) {
    return `${raw}-01`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  return null;
}

function buildTemporaryPassword() {
  return `SV-${crypto.randomUUID()}`.slice(0, 20);
}

async function getRequesterProfile(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, full_name, role, status")
    .eq("id", userId)
    .maybeSingle();

  return { data: data as StaffProfile | null, error };
}

function hasStaffAccess(profile: StaffProfile | null) {
  return profile?.status === "active" && (profile.role === "admin" || profile.role === "superadmin");
}

function hasSuperAdminAccess(profile: StaffProfile | null) {
  return profile?.status === "active" && profile.role === "superadmin";
}

async function logApplicationEvent(
  admin: ReturnType<typeof createAdminClient>,
  payload: {
    applicationId: string;
    action: "submitted" | "under_review" | "approved" | "rejected" | "account_created" | "note";
    fromStatus?: ApplicationStatus | null;
    toStatus?: ApplicationStatus | null;
    actorProfileId?: string | null;
    actorEmail?: string | null;
    notes?: string | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  const { error } = await admin.from("user_application_events").insert({
    application_id: payload.applicationId,
    action: payload.action,
    from_status: payload.fromStatus ?? null,
    to_status: payload.toStatus ?? null,
    actor_profile_id: payload.actorProfileId ?? null,
    actor_email: payload.actorEmail ?? null,
    notes: payload.notes ?? null,
    metadata: payload.metadata ?? null,
  });

  if (error) {
    console.error("Unable to write user application event", error.message);
  }
}

// Enable logger
app.use("*", logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.use("/server/api/*", async (c, next) => {
  try {
    const auth = await requireUser(c.req.header("Authorization"));
    c.set("supabase", auth.client);
    c.set("user", auth.user);
    await next();
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    return c.json({ error: "Authentication failed." }, 401);
  }
});

// Health check endpoint
app.get("/server/health", (c) => {
  return c.json({ status: "ok", service: "soleyvolt-backend" });
});

app.get("/server/public/coin-settings", async (c) => {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("coin_settings")
    .select(
      "id, red_coin_rate, yellow_coin_rate, yellow_coin_bill_offset_rate, green_coin_unit_price, green_coin_bill_offset_rate, updated_at",
    )
    .eq("id", true)
    .maybeSingle();

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  if (!data) {
    return c.json({ error: "Coin settings not found." }, 404);
  }

  return c.json(data);
});

app.post("/server/public/applications", async (c) => {
  const admin = createAdminClient();
  const body = await c.req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return c.json({ error: "Invalid JSON body." }, 400);
  }

  const fullName = trimString(body.full_name);
  const nic = normalizeNic(body.nic);
  const email = normalizeEmail(body.email);
  const phone = trimString(body.phone);
  const address = trimString(body.address);
  const preferredLanguage = parseLanguage(body.preferred_language);
  const requestedUserType = parseRequestedUserType(body.applicant_type ?? body.requested_user_type);
  const notes = trimString(body.notes);

  if (!fullName || !nic || !email || !phone || !address) {
    return c.json({ error: "Full name, NIC, email, phone, and address are required." }, 400);
  }

  if (!isValidEmail(email)) {
    return c.json({ error: "A valid email address is required." }, 400);
  }

  if (!isValidNic(nic)) {
    return c.json({ error: "NIC must contain exactly 14 alphanumeric characters." }, 400);
  }

  const [existingEmailApplication, existingNicApplication, existingProfile] = await Promise.all([
    admin
      .from("user_applications")
      .select("id")
      .eq("email", email)
      .in("status", ["pending", "under_review"])
      .limit(1)
      .maybeSingle(),
    admin
      .from("user_applications")
      .select("id")
      .eq("nic", nic)
      .in("status", ["pending", "under_review"])
      .limit(1)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("id, email, status")
      .eq("email", email)
      .limit(1)
      .maybeSingle(),
  ]);

  if (existingProfile.error) {
    return c.json({ error: existingProfile.error.message }, 400);
  }

  if (existingProfile.data) {
    return c.json({ error: "A SoleyVolt account already exists for this email address." }, 409);
  }

  if (existingEmailApplication.error || existingNicApplication.error) {
    return c.json(
      {
        error:
          existingEmailApplication.error?.message ??
          existingNicApplication.error?.message ??
          "Unable to validate duplicate applications.",
      },
      400,
    );
  }

  if (existingEmailApplication.data || existingNicApplication.data) {
    return c.json({ error: "A pending application already exists for this email or NIC." }, 409);
  }

  const { data, error } = await admin
    .from("user_applications")
    .insert({
      full_name: fullName,
      nic,
      email,
      phone,
      address,
      preferred_language: preferredLanguage,
      requested_user_type: requestedUserType,
      notes: notes || null,
      status: "pending",
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    const message =
      error?.code === "23505"
        ? "A pending application already exists for this email or NIC."
        : error?.message ?? "Unable to submit application.";
    return c.json({ error: message }, 400);
  }

  await logApplicationEvent(admin, {
    applicationId: data.id,
    action: "submitted",
    toStatus: "pending",
    actorEmail: email,
    notes: "Application submitted from public website.",
    metadata: {
      requested_user_type: requestedUserType,
      preferred_language: preferredLanguage,
    },
  });

  return c.json(
    {
      message: "Application submitted successfully.",
      application: data,
    },
    201,
  );
});

app.get("/server/api/me", async (c) => {
  const supabase = c.get("supabase");
  const user = c.get("user");

  const [profileResult, settingsResult, walletResult, transactionsResult, energyResult] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("energy_readings")
        .select("*")
        .eq("user_id", user.id)
        .order("reading_date", { ascending: false })
        .limit(12),
    ]);

  const firstError =
    profileResult.error ??
    settingsResult.error ??
    walletResult.error ??
    transactionsResult.error ??
    energyResult.error;

  if (firstError) {
    return c.json({ error: firstError.message }, 400);
  }

  return c.json({
    user,
    profile: profileResult.data,
    settings: settingsResult.data,
    wallet: walletResult.data,
    transactions: transactionsResult.data ?? [],
    energy_readings: energyResult.data ?? [],
  });
});

app.get("/server/api/profile", async (c) => {
  const supabase = c.get("supabase");
  const user = c.get("user");
  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json(data);
});

app.patch("/server/api/profile", async (c) => {
  const supabase = c.get("supabase");
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return c.json({ error: "Invalid JSON body." }, 400);
  }

  const updates = {
    full_name: typeof body.full_name === "string" ? body.full_name : undefined,
    phone: typeof body.phone === "string" ? body.phone : undefined,
    language: typeof body.language === "string" ? body.language : undefined,
    avatar_url: typeof body.avatar_url === "string" ? body.avatar_url : undefined,
  };

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json(data);
});

app.get("/server/api/settings", async (c) => {
  const supabase = c.get("supabase");
  const user = c.get("user");
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json(data);
});

app.patch("/server/api/settings", async (c) => {
  const supabase = c.get("supabase");
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return c.json({ error: "Invalid JSON body." }, 400);
  }

  const updates = {
    email_notifications:
      typeof body.email_notifications === "boolean" ? body.email_notifications : undefined,
    push_notifications:
      typeof body.push_notifications === "boolean" ? body.push_notifications : undefined,
    transaction_alerts:
      typeof body.transaction_alerts === "boolean" ? body.transaction_alerts : undefined,
    mfa_enabled: typeof body.mfa_enabled === "boolean" ? body.mfa_enabled : undefined,
  };

  const { data, error } = await supabase
    .from("user_settings")
    .update(updates)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json(data);
});

app.get("/server/api/wallet", async (c) => {
  const supabase = c.get("supabase");
  const user = c.get("user");
  const limit = Number(c.req.query("limit") ?? "20");

  const [walletResult, transactionsResult] = await Promise.all([
    supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 20),
  ]);

  if (walletResult.error || transactionsResult.error) {
    return c.json(
      { error: walletResult.error?.message ?? transactionsResult.error?.message ?? "Unknown error." },
      400,
    );
  }

  return c.json({
    wallet: walletResult.data,
    transactions: transactionsResult.data ?? [],
  });
});

app.get("/server/api/users/search", async (c) => {
  const user = c.get("user");
  const admin = createAdminClient();
  const query = trimString(c.req.query("q"));

  if (query.length < 2) {
    return c.json([]);
  }

  const searchByName = admin
    .from("profiles")
    .select("id, full_name, avatar_url, email")
    .eq("status", "active")
    .neq("id", user.id)
    .ilike("full_name", `%${query}%`)
    .order("full_name", { ascending: true })
    .limit(10);

  const searchByEmail = admin
    .from("profiles")
    .select("id, full_name, avatar_url, email")
    .eq("status", "active")
    .neq("id", user.id)
    .ilike("email", `%${query}%`)
    .order("email", { ascending: true })
    .limit(10);

  const [nameResult, emailResult] = await Promise.all([searchByName, searchByEmail]);

  if (nameResult.error || emailResult.error) {
    return c.json({ error: nameResult.error?.message ?? emailResult.error?.message ?? "Unable to search users." }, 400);
  }

  const merged = new Map<string, { id: string; full_name: string | null; avatar_url: string | null; email: string | null }>();

  for (const row of [...(emailResult.data ?? []), ...(nameResult.data ?? [])]) {
    if (!merged.has(row.id)) {
      merged.set(row.id, {
        id: row.id,
        full_name: row.full_name ?? null,
        avatar_url: row.avatar_url ?? null,
        email: row.email ?? null,
      });
    }
  }

  return c.json([...merged.values()].slice(0, 10));
});

app.get("/server/api/green-tokens/sellers/search", async (c) => {
  const user = c.get("user");
  const admin = createAdminClient();
  const query = trimString(c.req.query("q"));

  if (query.length < 2) {
    return c.json([]);
  }

  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, avatar_url, user_type")
    .eq("status", "active")
    .neq("id", user.id)
    .in("user_type", ["producer", "prosumer"])
    .ilike("full_name", `%${query}%`)
    .order("full_name", { ascending: true })
    .limit(10);

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json(data ?? []);
});

app.post("/server/api/transfer", async (c) => {
  const supabase = c.get("supabase");
  const body = await c.req.json().catch(() => null);

  if (!body || typeof body.receiver_id !== "string" || typeof body.amount !== "number") {
    return c.json({ error: "receiver_id and numeric amount are required." }, 400);
  }

  const { data, error } = await supabase.rpc("transfer_tokens", {
    receiver_id: body.receiver_id,
    transfer_amount: body.amount,
    transfer_description: typeof body.description === "string" ? body.description : null,
  });

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ transaction: data });
});

app.post("/server/api/green-tokens/purchase", async (c) => {
  return c.json(
    {
      error: "Direct green token purchase is disabled. Create a purchase request and wait for seller approval.",
    },
    400,
  );
});

app.post("/server/api/green-tokens/requests", async (c) => {
  const admin = createAdminClient();
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);

  if (!body || typeof body.seller_id !== "string" || typeof body.amount_rs !== "number") {
    return c.json({ error: "seller_id and numeric amount_rs are required." }, 400);
  }

  try {
    const result = await createGreenPurchaseRequest(admin, user.id, body.seller_id, body.amount_rs);
    if (!result.success) {
      return c.json(result, 400);
    }
    return c.json(result, 201);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unable to create purchase request." }, 400);
  }
});

app.post("/server/api/green-tokens/requests/:requestId/accept", async (c) => {
  const admin = createAdminClient();
  const user = c.get("user");
  const requestId = c.req.param("requestId");

  if (!requestId) {
    return c.json({ error: "requestId is required." }, 400);
  }

  try {
    const result = await acceptGreenPurchaseRequest(admin, requestId, user.id);
    if (!result.success) {
      return c.json(result, 400);
    }
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unable to accept purchase request." }, 400);
  }
});

app.post("/server/api/green-tokens/requests/:requestId/reject", async (c) => {
  const admin = createAdminClient();
  const user = c.get("user");
  const requestId = c.req.param("requestId");
  const body = await c.req.json().catch(() => ({}));

  if (!requestId) {
    return c.json({ error: "requestId is required." }, 400);
  }

  try {
    const result = await rejectGreenPurchaseRequest(
      admin,
      requestId,
      user.id,
      typeof body?.reason === "string" ? body.reason : null,
    );
    if (!result.success) {
      return c.json(result, 400);
    }
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unable to reject purchase request." }, 400);
  }
});

app.get("/server/api/green-tokens/requests/pending", async (c) => {
  const admin = createAdminClient();
  const user = c.get("user");
  const asSeller = (c.req.query("as_seller") ?? "true").toLowerCase() !== "false";

  try {
    const result = await getPendingPurchaseRequests(admin, user.id, asSeller);
    if (!result.success) {
      return c.json(result, 400);
    }
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unable to load pending purchase requests." }, 400);
  }
});

app.get("/server/api/green-tokens/requests/history", async (c) => {
  const admin = createAdminClient();
  const user = c.get("user");
  const statusFilter = trimString(c.req.query("status"));
  const limitRaw = Number.parseInt(c.req.query("limit") ?? "50", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;

  try {
    const result = await getPurchaseRequestHistory(admin, user.id, statusFilter || null, limit);
    if (!result.success) {
      return c.json(result, 400);
    }
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unable to load purchase request history." }, 400);
  }
});

app.post("/server/api/green-tokens/settlement", async (c) => {
  const admin = createAdminClient();
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const month = normalizeMonthInput(body?.month);

  if (body?.month != null && month == null) {
    return c.json({ error: "month must be YYYY-MM or YYYY-MM-DD." }, 400);
  }

  if (body?.user_id != null && typeof body.user_id !== "string") {
    return c.json({ error: "user_id must be a string when provided." }, 400);
  }

  const targetUserId = typeof body?.user_id === "string" ? body.user_id : user.id;

  if (targetUserId !== user.id) {
    const requester = await getRequesterProfile(admin, user.id);
    if (requester.error || !hasStaffAccess(requester.data)) {
      return c.json({ error: "Active staff access required." }, 403);
    }
  }

  try {
    const result = await processEndOfMonthSettlementDirect(admin, targetUserId, month);
    if (!result.success) {
      return c.json(result, 400);
    }
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unable to run settlement." }, 400);
  }
});

app.post("/server/api/admin/green-tokens/settlement-all", async (c) => {
  const admin = createAdminClient();
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const month = normalizeMonthInput(body?.month);

  if (body?.month != null && month == null) {
    return c.json({ error: "month must be YYYY-MM or YYYY-MM-DD." }, 400);
  }

  const requester = await getRequesterProfile(admin, user.id);
  if (requester.error || !hasStaffAccess(requester.data)) {
    return c.json({ error: "Active staff access required." }, 403);
  }

  try {
    const result = await processAllUsersEndOfMonthDirect(admin, month);
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unable to run batch settlement." }, 400);
  }
});

app.get("/server/api/transactions/history", async (c) => {
  const admin = createAdminClient();
  const user = c.get("user");
  const userId = trimString(c.req.query("user_id"));
  const tokenType = trimString(c.req.query("token_type"));
  const limitRaw = Number.parseInt(c.req.query("limit") ?? "50", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
  const targetUserId = userId || user.id;

  if (targetUserId !== user.id) {
    const requester = await getRequesterProfile(admin, user.id);
    if (requester.error || !hasStaffAccess(requester.data)) {
      return c.json({ error: "Active staff access required." }, 403);
    }
  }

  try {
    const result = await getUserTransactionHistoryDirect(admin, targetUserId, {
      tokenType: tokenType || null,
      limit,
    });
    if (!result.success) {
      return c.json(result, 400);
    }
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unable to load transaction history." }, 400);
  }
});

app.post("/server/api/energy", async (c) => {
  const supabase = c.get("supabase");
  const body = await c.req.json().catch(() => null);

  if (
    !body ||
    typeof body.imported !== "number" ||
    typeof body.exported !== "number"
  ) {
    return c.json({ error: "Numeric imported and exported values are required." }, 400);
  }

  const { data, error } = await supabase.rpc("record_energy_reading", {
    target_date: typeof body.target_date === "string" ? body.target_date : null,
    imported: body.imported,
    exported: body.exported,
    notes_input: typeof body.notes === "string" ? body.notes : null,
  });

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ reading: data });
});

app.get("/server/api/admin/overview", async (c) => {
  const admin = createAdminClient();
  const user = c.get("user");

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    (profile?.role !== "admin" && profile?.role !== "superadmin")
  ) {
    return c.json({ error: "Staff access required." }, 403);
  }

  const [overviewResult, usersResult, transactionsResult, alertsResult] = await Promise.all([
    admin.from("admin_overview").select("*").maybeSingle(),
    admin
      .from("user_wallet_summary")
      .select("*")
      .order("balance", { ascending: false })
      .limit(25),
    admin
      .from("wallet_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const firstError =
    overviewResult.error ?? usersResult.error ?? transactionsResult.error ?? alertsResult.error;

  if (firstError) {
    return c.json({ error: firstError.message }, 400);
  }

  return c.json({
    overview: overviewResult.data,
    users: usersResult.data ?? [],
    transactions: transactionsResult.data ?? [],
    alerts: alertsResult.data ?? [],
  });
});

app.get("/server/api/admin/applications", async (c) => {
  const admin = createAdminClient();
  const user = c.get("user");
  const requester = await getRequesterProfile(admin, user.id);

  if (requester.error || !hasStaffAccess(requester.data)) {
    return c.json({ error: "Active staff access required." }, 403);
  }

  const [applicationsResult, eventsResult] = await Promise.all([
    admin
      .from("user_applications")
      .select("*")
      .order("submitted_at", { ascending: false })
      .limit(300),
    admin
      .from("user_application_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  if (applicationsResult.error || eventsResult.error) {
    return c.json(
      { error: applicationsResult.error?.message ?? eventsResult.error?.message ?? "Unable to load applications." },
      400,
    );
  }

  const profileIds = [
    ...(applicationsResult.data ?? []).flatMap((application) =>
      [application.reviewed_by, application.linked_profile_id].filter((value): value is string => Boolean(value))
    ),
    ...(eventsResult.data ?? []).flatMap((event) =>
      [event.actor_profile_id].filter((value): value is string => Boolean(value))
    ),
  ];

  const uniqueProfileIds = [...new Set(profileIds)];
  let profileMap = new Map<string, { full_name: string | null; email: string | null }>();

  if (uniqueProfileIds.length > 0) {
    const profilesResult = await admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", uniqueProfileIds);

    if (profilesResult.error) {
      return c.json({ error: profilesResult.error.message }, 400);
    }

    profileMap = new Map(
      (profilesResult.data ?? []).map((profile) => [
        profile.id,
        { full_name: profile.full_name ?? null, email: profile.email ?? null },
      ]),
    );
  }

  return c.json({
    applications: (applicationsResult.data ?? []).map((application) => ({
      ...application,
      reviewed_by_name: application.reviewed_by ? profileMap.get(application.reviewed_by)?.full_name ?? null : null,
      reviewed_by_email: application.reviewed_by ? profileMap.get(application.reviewed_by)?.email ?? null : null,
      linked_profile_name:
        application.linked_profile_id ? profileMap.get(application.linked_profile_id)?.full_name ?? null : null,
      linked_profile_email:
        application.linked_profile_id ? profileMap.get(application.linked_profile_id)?.email ?? null : null,
    })),
    events: (eventsResult.data ?? []).map((event) => ({
      ...event,
      actor_name: event.actor_profile_id ? profileMap.get(event.actor_profile_id)?.full_name ?? null : null,
      actor_profile_email: event.actor_profile_id ? profileMap.get(event.actor_profile_id)?.email ?? null : null,
    })),
  });
});

app.post("/server/api/admin/applications/:applicationId/status", async (c) => {
  const admin = createAdminClient();
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const applicationId = c.req.param("applicationId");

  if (!applicationId) {
    return c.json({ error: "Application id is required." }, 400);
  }

  const requester = await getRequesterProfile(admin, user.id);

  if (requester.error || !hasStaffAccess(requester.data)) {
    return c.json({ error: "Active staff access required." }, 403);
  }

  const nextStatus = parseApplicationStatus(body?.status);

  if (!nextStatus || nextStatus === "approved" || nextStatus === "pending") {
    return c.json({ error: "Applications can only be marked under review or rejected here." }, 400);
  }

  const rejectionReason = trimString(body?.rejection_reason);
  const notes = trimString(body?.notes);

  if (nextStatus === "rejected" && !rejectionReason) {
    return c.json({ error: "A rejection reason is required." }, 400);
  }

  const applicationResult = await admin
    .from("user_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();

  if (applicationResult.error) {
    return c.json({ error: applicationResult.error.message }, 400);
  }

  if (!applicationResult.data) {
    return c.json({ error: "Application not found." }, 404);
  }

  if (applicationResult.data.status === "approved") {
    return c.json({ error: "Approved applications cannot be changed." }, 409);
  }

  const { data, error } = await admin
    .from("user_applications")
    .update({
      status: nextStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      rejection_reason: nextStatus === "rejected" ? rejectionReason : null,
    })
    .eq("id", applicationId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return c.json({ error: error?.message ?? "Unable to update application status." }, 400);
  }

  await logApplicationEvent(admin, {
    applicationId,
    action: nextStatus === "under_review" ? "under_review" : "rejected",
    fromStatus: applicationResult.data.status,
    toStatus: nextStatus,
    actorProfileId: user.id,
    actorEmail: requester.data?.email ?? user.email ?? null,
    notes: nextStatus === "rejected" ? rejectionReason : notes || "Application marked under review.",
  });

  return c.json(data);
});

app.post("/server/api/admin/applications/:applicationId/approve", async (c) => {
  const admin = createAdminClient();
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const applicationId = c.req.param("applicationId");

  if (!applicationId) {
    return c.json({ error: "Application id is required." }, 400);
  }

  const requester = await getRequesterProfile(admin, user.id);

  if (requester.error || !hasStaffAccess(requester.data)) {
    return c.json({ error: "Active staff access required." }, 403);
  }

  const applicationResult = await admin
    .from("user_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();

  if (applicationResult.error) {
    return c.json({ error: applicationResult.error.message }, 400);
  }

  const application = applicationResult.data;

  if (!application) {
    return c.json({ error: "Application not found." }, 404);
  }

  if (application.status === "approved" || application.linked_profile_id) {
    return c.json({ error: "This application has already been approved." }, 409);
  }

  const preferredLanguage = parseLanguage(body?.preferred_language ?? application.preferred_language);
  const userType = parseRequestedUserType(body?.user_type ?? application.requested_user_type);
  const sendPasswordSetupEmail = body?.sendPasswordSetupEmail !== false;
  const redirectTo = trimString(body?.redirectTo);
  const temporaryPassword = trimString(body?.temporaryPassword) || buildTemporaryPassword();

  const existingProfile = await admin
    .from("profiles")
    .select("id, email")
    .eq("email", application.email)
    .maybeSingle();

  if (existingProfile.error) {
    return c.json({ error: existingProfile.error.message }, 400);
  }

  if (existingProfile.data) {
    return c.json({ error: "A SoleyVolt user already exists for this email address." }, 409);
  }

  const createUserResult = await admin.auth.admin.createUser({
    email: application.email,
    password: temporaryPassword,
    email_confirm: true,
    app_metadata: {
      role: "user",
      user_type: userType,
      status: "active",
      language: preferredLanguage,
      created_by: user.id,
      application_id: application.id,
    },
    user_metadata: {
      full_name: application.full_name,
      phone: application.phone,
      language: preferredLanguage,
      user_type: userType,
      nic: application.nic,
      address: application.address,
    },
  });

  if (createUserResult.error || !createUserResult.data.user) {
    return c.json({ error: createUserResult.error?.message ?? "Unable to create user account." }, 400);
  }

  const createdUser = createUserResult.data.user;

  const profileUpsert = await admin
    .from("profiles")
    .upsert(
      {
        id: createdUser.id,
        email: application.email,
        full_name: application.full_name,
        phone: application.phone,
        language: preferredLanguage,
        role: "user",
        user_type: userType,
        status: "active",
        created_by: user.id,
      },
      { onConflict: "id" },
    )
    .select("id, email, full_name")
    .maybeSingle();

  if (profileUpsert.error || !profileUpsert.data) {
    return c.json({ error: profileUpsert.error?.message ?? "Unable to create user profile." }, 400);
  }

  const applicationUpdate = await admin
    .from("user_applications")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      rejection_reason: null,
      linked_profile_id: createdUser.id,
      preferred_language: preferredLanguage,
      requested_user_type: userType,
    })
    .eq("id", applicationId)
    .select("*")
    .maybeSingle();

  if (applicationUpdate.error || !applicationUpdate.data) {
    return c.json({ error: applicationUpdate.error?.message ?? "Unable to update approved application." }, 400);
  }

  let passwordSetupEmailSent = false;

  if (sendPasswordSetupEmail && redirectTo) {
    const resetResult = await admin.auth.resetPasswordForEmail(application.email, {
      redirectTo,
    });

    if (!resetResult.error) {
      passwordSetupEmailSent = true;
    }
  }

  await logApplicationEvent(admin, {
    applicationId,
    action: "approved",
    fromStatus: application.status,
    toStatus: "approved",
    actorProfileId: user.id,
    actorEmail: requester.data?.email ?? user.email ?? null,
    notes: "Application approved and linked to a new SoleyVolt account.",
  });

  await logApplicationEvent(admin, {
    applicationId,
    action: "account_created",
    actorProfileId: user.id,
    actorEmail: requester.data?.email ?? user.email ?? null,
    notes: passwordSetupEmailSent
      ? "User account created and password setup email sent."
      : "User account created with a temporary password.",
    metadata: {
      created_user_id: createdUser.id,
      created_user_email: application.email,
      password_setup_email_sent: passwordSetupEmailSent,
    },
  });

  await admin.from("notifications").insert({
    user_id: user.id,
    notification_type: "success",
    title: "Application approved",
    message: `Application for ${application.email} was approved and converted into an active user account.`,
  });

  return c.json({
    application: applicationUpdate.data,
    user: {
      id: createdUser.id,
      email: application.email,
      role: "user",
      status: "active",
      user_type: userType,
    },
    invitation: {
      passwordSetupEmailSent,
      redirectTo: redirectTo || null,
      temporaryPassword: passwordSetupEmailSent ? null : temporaryPassword,
    },
  });
});

app.get("/server/api/admin/energy-pipeline", async (c) => {
  const admin = createAdminClient();
  const user = c.get("user");

  const { data: requesterProfile, error: requesterProfileError } = await admin
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (
    requesterProfileError ||
    (requesterProfile?.role !== "admin" && requesterProfile?.role !== "superadmin") ||
    requesterProfile?.status !== "active"
  ) {
    return c.json({ error: "Active staff access required." }, 403);
  }

  const [importsResult, mappingsResult, profilesResult] = await Promise.all([
    admin
      .from("energy_readings_import")
      .select("*")
      .order("dataset_user_code", { ascending: true })
      .order("billing_cycle", { ascending: true })
      .limit(120),
    admin
      .from("dataset_user_mappings")
      .select("*")
      .order("dataset_user_code", { ascending: true }),
    admin
      .from("profiles")
      .select("id, full_name, email, role, user_type, status")
      .eq("status", "active")
      .order("full_name", { ascending: true })
      .limit(100),
  ]);

  const firstError = importsResult.error ?? mappingsResult.error ?? profilesResult.error;

  if (firstError) {
    return c.json({ error: firstError.message }, 400);
  }

  const importRows = importsResult.data ?? [];
  const linkedProfileIds = [...new Set(importRows.map((row) => row.linked_user_id).filter((value): value is string => Boolean(value)))];

  let linkedProfilesById = new Map<string, { full_name: string | null; email: string | null }>();
  let latestRun: {
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
  } | null = null;

  if (linkedProfileIds.length > 0) {
    const { data: linkedProfiles, error: linkedProfilesError } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", linkedProfileIds);

    if (linkedProfilesError) {
      return c.json({ error: linkedProfilesError.message }, 400);
    }

    linkedProfilesById = new Map(
      (linkedProfiles ?? []).map((profile) => [
        profile.id,
        {
          full_name: profile.full_name ?? null,
          email: profile.email ?? null,
        },
      ]),
    );
  }

  const latestRunResult = await admin
    .from("energy_pipeline_runs")
    .select(
      "id, trigger_source, status, calculation_version, rows_considered, processed_count, failed_count, promoted_count, statuses_filter, promote, dry_run, anchor_date, started_at, completed_at, error_summary",
    )
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestRunResult.error) {
    latestRun = latestRunResult.data;
  }

  return c.json({
    imports: importRows.map((row) => {
      const linkedProfile = row.linked_user_id ? linkedProfilesById.get(row.linked_user_id) : null;

      return {
        ...row,
        linked_user_name: linkedProfile?.full_name ?? null,
        linked_user_email: linkedProfile?.email ?? null,
      };
    }),
    mappings: mappingsResult.data ?? [],
    profiles: profilesResult.data ?? [],
    latestRun,
  });
});

app.post("/server/api/admin/energy-pipeline/run", async (c) => {
  const admin = createAdminClient();
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);

  const { data: requesterProfile, error: requesterProfileError } = await admin
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (
    requesterProfileError ||
    (requesterProfile?.role !== "admin" && requesterProfile?.role !== "superadmin") ||
    requesterProfile?.status !== "active"
  ) {
    return c.json({ error: "Active staff access required." }, 403);
  }

  const statuses = Array.isArray(body?.statuses)
    ? body.statuses.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : ["pending", "failed", "calculated"];
  const limitInput = typeof body?.limit === "number" ? body.limit : 100;
  const limit = Number.isFinite(limitInput) ? Math.min(Math.max(Math.trunc(limitInput), 1), 500) : 100;
  const calculationVersion =
    typeof body?.calculationVersion === "string" && body.calculationVersion.trim().length > 0
      ? body.calculationVersion.trim()
      : Deno.env.get("ENERGY_CALCULATION_VERSION") ?? "server-legacy-v1";
  const anchorDate =
    typeof body?.anchorDate === "string" && body.anchorDate.trim().length > 0
      ? body.anchorDate.trim()
      : Deno.env.get("ENERGY_BILLING_ANCHOR_DATE") ?? null;
  const promote = typeof body?.promote === "boolean" ? body.promote : true;
  const dryRun = typeof body?.dryRun === "boolean" ? body.dryRun : false;

  try {
    const summary = await runEnergyPipeline(admin, {
      limit,
      statuses,
      calculationVersion,
      anchorDate,
      promote,
      dryRun,
      triggerSource: "admin-api",
    });

    return c.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Energy pipeline execution failed.";
    return c.json({ error: message }, 400);
  }
});

app.post("/server/api/admin/energy-pipeline/mappings/:datasetUserCode", async (c) => {
  const admin = createAdminClient();
  const user = c.get("user");
  const datasetUserCode = c.req.param("datasetUserCode");
  const body = await c.req.json().catch(() => null);

  if (!datasetUserCode) {
    return c.json({ error: "Dataset user code is required." }, 400);
  }

  if (!body || typeof body.linkedUserId !== "string" || !body.linkedUserId.trim()) {
    return c.json({ error: "A linked user id is required." }, 400);
  }

  const { data: requesterProfile, error: requesterProfileError } = await admin
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (
    requesterProfileError ||
    (requesterProfile?.role !== "admin" && requesterProfile?.role !== "superadmin") ||
    requesterProfile?.status !== "active"
  ) {
    return c.json({ error: "Active staff access required." }, 403);
  }

  const providedDatasetType =
    body.datasetUserType === "consumer" ||
    body.datasetUserType === "producer" ||
    body.datasetUserType === "prosumer"
      ? body.datasetUserType
      : null;

  const latestImportResult = await admin
    .from("energy_readings_import")
    .select("id, dataset_user_type, source_file_name")
    .eq("dataset_user_code", datasetUserCode)
    .order("billing_cycle", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestImportResult.error) {
    return c.json({ error: latestImportResult.error.message }, 400);
  }

  const resolvedDatasetType = providedDatasetType ?? latestImportResult.data?.dataset_user_type ?? null;

  if (
    resolvedDatasetType !== "consumer" &&
    resolvedDatasetType !== "producer" &&
    resolvedDatasetType !== "prosumer"
  ) {
    return c.json({ error: `Unable to resolve dataset user type for ${datasetUserCode}.` }, 400);
  }

  const mappingUpsertResult = await admin
    .from("dataset_user_mappings")
    .upsert(
      {
        dataset_user_code: datasetUserCode,
        dataset_user_type: resolvedDatasetType,
        linked_user_id: body.linkedUserId,
        source_file_name:
          typeof body.sourceFileName === "string" && body.sourceFileName.trim().length > 0
            ? body.sourceFileName.trim()
            : latestImportResult.data?.source_file_name ?? null,
        notes: typeof body.notes === "string" ? body.notes : null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "dataset_user_code",
      },
    )
    .select("*")
    .maybeSingle();

  if (mappingUpsertResult.error || !mappingUpsertResult.data) {
    return c.json({ error: mappingUpsertResult.error?.message ?? "Unable to save dataset mapping." }, 400);
  }

  const importUpdateResult = await admin
    .from("energy_readings_import")
    .update({
      linked_user_id: body.linkedUserId,
    })
    .eq("dataset_user_code", datasetUserCode);

  if (importUpdateResult.error) {
    return c.json({ error: importUpdateResult.error.message }, 400);
  }

  const failedImportResetResult = await admin
    .from("energy_readings_import")
    .update({
      processing_status: "pending",
      processing_error: null,
    })
    .eq("dataset_user_code", datasetUserCode)
    .in("processing_status", ["failed", "processing"]);

  if (failedImportResetResult.error) {
    return c.json({ error: failedImportResetResult.error.message }, 400);
  }

  const importIdsResult = await admin
    .from("energy_readings_import")
    .select("id")
    .eq("dataset_user_code", datasetUserCode);

  if (importIdsResult.error) {
    return c.json({ error: importIdsResult.error.message }, 400);
  }

  const importIds = (importIdsResult.data ?? []).map((row) => row.id).filter(Boolean);

  if (importIds.length > 0) {
    const calculationsUpdateResult = await admin
      .from("energy_calculations")
      .update({
        linked_user_id: body.linkedUserId,
      })
      .in("import_id", importIds);

    if (calculationsUpdateResult.error) {
      return c.json({ error: calculationsUpdateResult.error.message }, 400);
    }
  }

  return c.json(mappingUpsertResult.data);
});

app.post("/server/api/admin/users", async (c) => {
  const admin = createAdminClient();
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);

  if (
    !body ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    return c.json({ error: "Email and password are required." }, 400);
  }

  const email = body.email.trim().toLowerCase();
  const password = body.password.trim();
  const fullName =
    typeof body.full_name === "string" && body.full_name.trim().length > 0
      ? body.full_name.trim()
      : "SoleyVolt User";
  const language =
    body.language === "fr" || body.language === "cr" ? body.language : "en";
  const userType =
    body.user_type === "consumer" || body.user_type === "producer" || body.user_type === "prosumer"
      ? body.user_type
      : "prosumer";
  const status =
    body.status === "inactive" || body.status === "suspended" ? body.status : "active";

  if (!email) {
    return c.json({ error: "A valid email is required." }, 400);
  }

  if (password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters long." }, 400);
  }

  const { data: requesterProfile, error: requesterProfileError } = await admin
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (
    requesterProfileError ||
    (requesterProfile?.role !== "admin" && requesterProfile?.role !== "superadmin") ||
    requesterProfile?.status !== "active"
  ) {
    return c.json({ error: "Active staff access required." }, 403);
  }

  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      role: "user",
      user_type: userType,
      status,
      language,
      created_by: user.id,
    },
    user_metadata: {
      full_name: fullName,
      user_type: userType,
      language,
    },
  });

  if (createUserError || !createdUser.user) {
    return c.json({ error: createUserError?.message ?? "Unable to create user account." }, 400);
  }

  const { error: notificationError } = await admin.from("notifications").insert({
    user_id: user.id,
    notification_type: "warning",
    title: "User account created",
    message: `User ${email} (${userType}) was created by ${user.email ?? user.id}. Require a password change on first login.`,
  });

  if (notificationError) {
    return c.json({ error: notificationError.message }, 400);
  }

  return c.json({
    user: {
      id: createdUser.user.id,
      email: createdUser.user.email,
      role: "user",
      status,
    },
  });
});

app.get("/server/api/super-admin/admins", async (c) => {
  const admin = createAdminClient();
  const user = c.get("user");

  const { data: requesterProfile, error: requesterProfileError } = await admin
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (
    requesterProfileError ||
    requesterProfile?.role !== "superadmin" ||
    requesterProfile?.status !== "active"
  ) {
    return c.json({ error: "Active super admin access required." }, 403);
  }

  const { data, error } = await admin
    .from("profiles")
    .select("id, email, full_name, role, user_type, status, language, created_by")
    .in("role", ["admin", "superadmin"])
    .order("full_name", { ascending: true });

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json(data ?? []);
});

app.post("/server/api/super-admin/admins", async (c) => {
  const admin = createAdminClient();
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);

  if (
    !body ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    return c.json({ error: "Email and password are required." }, 400);
  }

  const email = body.email.trim().toLowerCase();
  const password = body.password.trim();
  const fullName =
    typeof body.full_name === "string" && body.full_name.trim().length > 0
      ? body.full_name.trim()
      : "Admin User";
  const language =
    body.language === "fr" || body.language === "cr" ? body.language : "en";
  const status =
    body.status === "inactive" || body.status === "suspended" ? body.status : "active";

  if (!email) {
    return c.json({ error: "A valid email is required." }, 400);
  }

  if (password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters long." }, 400);
  }

  const { data: requesterProfile, error: requesterProfileError } = await admin
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (
    requesterProfileError ||
    requesterProfile?.role !== "superadmin" ||
    requesterProfile?.status !== "active"
  ) {
    return c.json({ error: "Active super admin access required." }, 403);
  }

  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      role: "admin",
      user_type: "consumer",
      status,
      language,
      created_by: user.id,
    },
    user_metadata: {
      full_name: fullName,
      language,
    },
  });

  if (createUserError || !createdUser.user) {
    return c.json({ error: createUserError?.message ?? "Unable to create admin user." }, 400);
  }

  const { error: notificationError } = await admin.from("notifications").insert({
    user_id: user.id,
    notification_type: "warning",
    title: "Admin account created",
    message: `Admin ${email} was created by super admin ${user.email ?? user.id}. Require a password change on first login.`,
  });

  if (notificationError) {
    return c.json({ error: notificationError.message }, 400);
  }

  return c.json({
    user: {
      id: createdUser.user.id,
      email: createdUser.user.email,
      role: "admin",
      status,
    },
  });
});

app.post("/server/api/admin/users/:userId/password-reset", async (c) => {
  const admin = createAdminClient();
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const userId = c.req.param("userId");
  const redirectTo = typeof body?.redirectTo === "string" ? body.redirectTo.trim() : "";

  if (!userId) {
    return c.json({ error: "User id is required." }, 400);
  }

  if (!redirectTo) {
    return c.json({ error: "A valid password reset redirect URL is required." }, 400);
  }

  const { data: requesterProfile, error: requesterProfileError } = await admin
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (
    requesterProfileError ||
    (requesterProfile?.role !== "admin" && requesterProfile?.role !== "superadmin") ||
    requesterProfile?.status !== "active"
  ) {
    return c.json({ error: "Active staff access required." }, 403);
  }

  const { data: targetUserResult, error: targetUserError } = await admin.auth.admin.getUserById(userId);
  const targetEmail = targetUserResult.user?.email?.trim().toLowerCase();

  if (targetUserError || !targetEmail) {
    return c.json({ error: targetUserError?.message ?? "User email was not found." }, 400);
  }

  const { error: resetError } = await admin.auth.resetPasswordForEmail(targetEmail, {
    redirectTo,
  });

  if (resetError) {
    return c.json({ error: resetError.message }, 400);
  }

  const { error: notificationError } = await admin.from("notifications").insert({
    user_id: user.id,
    notification_type: "warning",
    title: "Password reset requested",
    message: `A password reset email was sent to ${targetEmail} by ${user.email ?? user.id}.`,
  });

  if (notificationError) {
    return c.json({ error: notificationError.message }, 400);
  }

  return c.json({ ok: true, email: targetEmail });
});

Deno.serve(app.fetch);
