import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createAdminClient, requireUser } from "./supabase.ts";

type Variables = {
  supabase: Awaited<ReturnType<typeof requireUser>>["client"];
  user: Awaited<ReturnType<typeof requireUser>>["user"];
};

const app = new Hono<{ Variables: Variables }>();

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
  const query = (c.req.query("q") ?? "").trim();

  if (!query) {
    return c.json([]);
  }

  const { data, error } = await admin
    .from("public_user_directory")
    .select("id, full_name, avatar_url")
    .neq("id", user.id)
    .ilike("full_name", `%${query}%`)
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

  const { data, error } = await admin.rpc("apply_dataset_user_mapping", {
    dataset_code: datasetUserCode,
    profile_id: body.linkedUserId,
    dataset_type: typeof body.datasetUserType === "string" ? body.datasetUserType : null,
    source_file: typeof body.sourceFileName === "string" ? body.sourceFileName : null,
    mapping_notes: typeof body.notes === "string" ? body.notes : null,
  });

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json(data);
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
