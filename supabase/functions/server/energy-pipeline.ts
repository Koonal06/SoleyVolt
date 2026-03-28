import type { SupabaseClient } from "jsr:@supabase/supabase-js@2.49.8";

type JsonRecord = Record<string, unknown>;

type CoinSettings = {
  red_coin_rate: number;
};

type ImportRow = {
  id: string;
  source_file_name: string | null;
  dataset_user_code: string;
  dataset_user_type: string | null;
  meter_id: string | null;
  billing_cycle: number;
  reading_date: string | null;
  period_start: string | null;
  period_end: string | null;
  imported_kwh: number | null;
  exported_kwh: number | null;
  linked_user_id: string | null;
  processing_status: string;
  calculation_version: string | null;
};

type ImportHistoryRow = {
  id: string;
  dataset_user_code: string;
  meter_id: string | null;
  billing_cycle: number | null;
  reading_date: string | null;
  period_start: string | null;
  period_end: string | null;
  imported_kwh: number | null;
  exported_kwh: number | null;
  linked_user_id: string | null;
  processing_status: string;
};

type LegacyMonthlyCalculation = {
  imported_kwh: number;
  exported_kwh: number;
  net_kwh: number;
  yellow_tokens: number;
  red_tokens: number;
  tokens_earned: number;
  green_cap_kwh: number;
  green_purchased_kwh: number;
  remaining_green_cap_kwh: number;
  settlement_required_kwh: number;
  estimated_bill: number;
  reward_tier: "surplus" | "deficit" | "balanced";
  formula: Record<string, string>;
};

export type EnergyPipelineRunOptions = {
  limit: number;
  statuses: string[];
  calculationVersion: string;
  anchorDate: string | null;
  promote: boolean;
  dryRun: boolean;
  triggerSource: string;
};

export type EnergyPipelineRunSummary = {
  status: "completed" | "completed_with_errors" | "failed" | "skipped";
  rows_considered: number;
  processed_count: number;
  failed_count: number;
  promoted_count: number;
  error_summary: string | null;
  errors: Array<{
    import_id: string;
    dataset_user_code: string;
    billing_cycle: number;
    error: string;
    trigger_source: string;
  }>;
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const round3 = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function utcNowIso() {
  return new Date().toISOString();
}

function classifyRewardTier(netKwh: number): "surplus" | "deficit" | "balanced" {
  if (netKwh > 0) {
    return "surplus";
  }

  if (netKwh < 0) {
    return "deficit";
  }

  return "balanced";
}

function calculateGreenCap(historyImports: Array<number | null | undefined>) {
  const eligible = historyImports
    .map((value) => round3(Math.max(numeric(value), 0)))
    .filter((value) => Number.isFinite(value));

  if (eligible.length === 0) {
    return 0;
  }

  const recent = eligible.slice(-3);
  const averageImport = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  return round3(averageImport / 2);
}

function calculateMonthlyResult(params: {
  importedKwh: number | null | undefined;
  exportedKwh: number | null | undefined;
  historyImports: Array<number | null | undefined>;
  greenPurchasedKwh: number | null | undefined;
  redCoinRate: number | null | undefined;
}): LegacyMonthlyCalculation {
  const imported = round3(Math.max(numeric(params.importedKwh), 0));
  const exported = round3(Math.max(numeric(params.exportedKwh), 0));
  const greenPurchased = round3(Math.max(numeric(params.greenPurchasedKwh), 0));
  const redCoinRate = numeric(params.redCoinRate);
  const netKwh = round3(exported - imported);
  const yellowTokens = netKwh > 0 ? round2(netKwh) : 0;
  const redTokens = netKwh < 0 ? round2(Math.abs(netKwh)) : 0;
  const greenCapKwh = calculateGreenCap(params.historyImports);
  const remainingGreenCapKwh = round3(Math.max(greenCapKwh - greenPurchased, 0));
  const settlementRequiredKwh = round3(Math.max(redTokens - greenPurchased, 0));
  const estimatedBill = round2(settlementRequiredKwh * redCoinRate);

  return {
    imported_kwh: imported,
    exported_kwh: exported,
    net_kwh: netKwh,
    yellow_tokens: yellowTokens,
    red_tokens: redTokens,
    tokens_earned: yellowTokens,
    green_cap_kwh: greenCapKwh,
    green_purchased_kwh: greenPurchased,
    remaining_green_cap_kwh: remainingGreenCapKwh,
    settlement_required_kwh: settlementRequiredKwh,
    estimated_bill: estimatedBill,
    reward_tier: classifyRewardTier(netKwh),
    formula: {
      yellow_tokens: "max(exported_kwh - imported_kwh, 0)",
      red_tokens: "max(imported_kwh - exported_kwh, 0)",
      green_cap_kwh: "average(last_3_imported_kwh_including_current_cycle) / 2",
      estimated_bill: "max(red_tokens - green_purchased_kwh, 0) * red_coin_rate",
    },
  };
}

function addMonths(anchor: Date, months: number) {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();
  const day = anchor.getUTCDate();
  const monthIndex = month + months;
  const next = new Date(Date.UTC(year, monthIndex, 1));
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function derivePeriodDates(anchorDate: string, billingCycle: number) {
  const anchor = new Date(`${anchorDate}T00:00:00.000Z`);
  const periodStart = addMonths(anchor, billingCycle - 1);
  const nextPeriodStart = addMonths(periodStart, 1);
  const periodEnd = new Date(nextPeriodStart.getTime() - 24 * 60 * 60 * 1000);

  return {
    periodStart: formatDateOnly(periodStart),
    periodEnd: formatDateOnly(periodEnd),
  };
}

function normalizeDate(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}

function deriveDatesForRow(row: ImportRow, anchorDate: string | null) {
  let readingDate = normalizeDate(row.reading_date);
  let periodStart = normalizeDate(row.period_start);
  let periodEnd = normalizeDate(row.period_end);

  if (!anchorDate) {
    return { readingDate, periodStart, periodEnd };
  }

  const derived = derivePeriodDates(anchorDate, Number(row.billing_cycle));
  readingDate = readingDate ?? derived.periodEnd;
  periodStart = periodStart ?? derived.periodStart;
  periodEnd = periodEnd ?? derived.periodEnd;

  return { readingDate, periodStart, periodEnd };
}

async function fetchCoinSettings(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("coin_settings")
    .select("red_coin_rate")
    .eq("id", true)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "coin_settings row not found.");
  }

  return {
    red_coin_rate: numeric(data.red_coin_rate),
  } satisfies CoinSettings;
}

async function fetchImportRows(admin: SupabaseClient, statuses: string[], limit: number) {
  const { data, error } = await admin
    .from("energy_readings_import")
    .select(
      "id, source_file_name, dataset_user_code, dataset_user_type, meter_id, billing_cycle, reading_date, period_start, period_end, imported_kwh, exported_kwh, linked_user_id, processing_status, calculation_version",
    )
    .in("processing_status", statuses)
    .order("billing_cycle", { ascending: true })
    .order("dataset_user_code", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ImportRow[];
}

async function fetchImportHistory(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("energy_readings_import")
    .select(
      "id, dataset_user_code, meter_id, billing_cycle, reading_date, period_start, period_end, imported_kwh, exported_kwh, linked_user_id, processing_status",
    )
    .order("meter_id", { ascending: true })
    .order("billing_cycle", { ascending: true })
    .limit(5000);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ImportHistoryRow[];
}

async function fetchGreenPurchasedKwh(
  admin: SupabaseClient,
  params: { linkedUserId: string | null; periodStart: string | null; periodEnd: string | null },
) {
  if (!params.linkedUserId) {
    return 0;
  }

  let query = admin
    .from("green_coin_purchases")
    .select("green_coins")
    .eq("user_id", params.linkedUserId)
    .eq("status", "completed")
    .limit(500);

  if (params.periodStart) {
    query = query.gte("created_at", `${params.periodStart}T00:00:00+00:00`);
  }

  if (params.periodEnd) {
    query = query.lte("created_at", `${params.periodEnd}T23:59:59+00:00`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return round3((data ?? []).reduce((sum, row) => sum + numeric(row.green_coins), 0));
}

async function startPipelineRun(
  admin: SupabaseClient,
  options: EnergyPipelineRunOptions,
) {
  try {
    const { data, error } = await admin
      .from("energy_pipeline_runs")
      .insert({
        trigger_source: options.triggerSource,
        status: "running",
        calculation_version: options.calculationVersion,
        statuses_filter: options.statuses,
        promote: options.promote,
        dry_run: options.dryRun,
        anchor_date: options.anchorDate,
        metadata: {
          limit: options.limit,
        },
      })
      .select("id")
      .maybeSingle();

    if (error) {
      console.warn("Unable to log pipeline run start:", error.message);
      return null;
    }

    return data?.id ?? null;
  } catch (error) {
    console.warn("Unable to log pipeline run start:", error);
    return null;
  }
}

async function finishPipelineRun(
  admin: SupabaseClient,
  runId: string | null,
  payload: {
    status: EnergyPipelineRunSummary["status"];
    rows_considered: number;
    processed_count: number;
    failed_count: number;
    promoted_count: number;
    error_summary: string | null;
    metadata?: JsonRecord;
  },
) {
  if (!runId) {
    return;
  }

  try {
    const { error } = await admin
      .from("energy_pipeline_runs")
      .update({
        status: payload.status,
        rows_considered: payload.rows_considered,
        processed_count: payload.processed_count,
        failed_count: payload.failed_count,
        promoted_count: payload.promoted_count,
        completed_at: utcNowIso(),
        error_summary: payload.error_summary,
        metadata: payload.metadata ?? {},
      })
      .eq("id", runId);

    if (error) {
      console.warn("Unable to log pipeline run completion:", error.message);
    }
  } catch (error) {
    console.warn("Unable to log pipeline run completion:", error);
  }
}

async function ensureWalletExists(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("wallets")
    .select("user_id, lifetime_earned, lifetime_spent, yellow_token, red_token, green_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    return data;
  }

  const insertResult = await admin
    .from("wallets")
    .insert({
      user_id: userId,
      lifetime_earned: 0,
      lifetime_spent: 0,
      yellow_token: 0,
      red_token: 0,
      green_token: 0,
    })
    .select("user_id, lifetime_earned, lifetime_spent, yellow_token, red_token, green_token")
    .maybeSingle();

  if (insertResult.error || !insertResult.data) {
    throw new Error(insertResult.error?.message ?? "Unable to create wallet for linked user.");
  }

  return insertResult.data;
}

async function fetchPreviousWalletAudit(
  admin: SupabaseClient,
  userId: string,
  importId: string,
) {
  try {
    const auditResult = await admin
      .from("wallet_audit_log")
      .select("id, yellow_delta, red_delta, green_delta")
      .eq("user_id", userId)
      .eq("import_id", importId)
      .eq("source", "monthly_calculation")
      .limit(1)
      .maybeSingle();

    if (!auditResult.error && auditResult.data) {
      return {
        auditMode: "wallet_audit_log" as const,
        id: auditResult.data.id,
        previousYellow: round2(numeric(auditResult.data.yellow_delta)),
        previousRed: round2(numeric(auditResult.data.red_delta)),
        previousGreen: round2(numeric(auditResult.data.green_delta)),
      };
    }
  } catch {
    // Fall through to wallet transaction metadata.
  }

  const transactionResult = await admin
    .from("wallet_transactions")
    .select("id, metadata")
    .eq("user_id", userId)
    .eq("description", "Legacy energy pipeline wallet reconciliation")
    .order("created_at", { ascending: false })
    .limit(50);

  if (transactionResult.error) {
    throw new Error(transactionResult.error.message);
  }

  const matched = (transactionResult.data ?? []).find((row) => {
    const metadata = row.metadata as JsonRecord | null;
    return metadata && String(metadata.import_id ?? "") === importId;
  });

  const metadata = (matched?.metadata as JsonRecord | null) ?? null;

  return {
    auditMode: "wallet_transactions" as const,
    id: matched?.id ?? null,
    previousYellow: round2(numeric(metadata?.yellow_delta)),
    previousRed: round2(numeric(metadata?.red_delta)),
    previousGreen: round2(numeric(metadata?.green_delta)),
  };
}

async function reconcileWalletAfterCalculation(
  admin: SupabaseClient,
  params: {
    userId: string;
    yellowTokens: number;
    redTokens: number;
    greenTokens?: number;
    importId: string;
    triggerSource: string;
    calculationVersion: string;
    readingDate: string;
  },
) {
  const wallet = await ensureWalletExists(admin, params.userId);
  const previousAudit = await fetchPreviousWalletAudit(admin, params.userId, params.importId);

  const deltaYellow = round2(params.yellowTokens - previousAudit.previousYellow);
  const deltaRed = round2(params.redTokens - previousAudit.previousRed);
  const deltaGreen = round2((params.greenTokens ?? 0) - previousAudit.previousGreen);

  if (Math.abs(deltaYellow) < 0.0001 && Math.abs(deltaRed) < 0.0001 && Math.abs(deltaGreen) < 0.0001) {
    const currentYellow = round2(numeric(wallet.yellow_token));
    const currentRed = round2(numeric(wallet.red_token));
    const currentGreen = round2(numeric(wallet.green_token));
    return {
      yellow_token: currentYellow,
      red_token: currentRed,
      green_token: currentGreen,
      balance: round2(Math.max(currentYellow + currentGreen - currentRed, 0)),
    };
  }

  const nextYellow = round2(Math.max(numeric(wallet.yellow_token) + deltaYellow, 0));
  const nextRed = round2(Math.max(numeric(wallet.red_token) + deltaRed, 0));
  const nextGreen = round2(Math.max(numeric(wallet.green_token) + deltaGreen, 0));
  const nextBalance = round2(Math.max(nextYellow + nextGreen - nextRed, 0));
  const nextLifetimeEarned = round2(
    numeric(wallet.lifetime_earned) + Math.max(deltaYellow + deltaGreen, 0),
  );
  const nextLifetimeSpent = round2(
    numeric(wallet.lifetime_spent) + Math.max(deltaRed, 0) + Math.abs(Math.min(deltaYellow + deltaGreen, 0)),
  );

  const walletUpdateResult = await admin
    .from("wallets")
    .update({
      yellow_token: nextYellow,
      red_token: nextRed,
      green_token: nextGreen,
      lifetime_earned: nextLifetimeEarned,
      lifetime_spent: nextLifetimeSpent,
      updated_at: utcNowIso(),
    })
    .eq("user_id", params.userId);

  if (walletUpdateResult.error) {
    throw new Error(walletUpdateResult.error.message);
  }

  const combinedDelta = round2(deltaYellow + deltaGreen - deltaRed);
  const metadata = {
    source: "monthly_calculation",
    import_id: params.importId,
    yellow_delta: params.yellowTokens,
    red_delta: params.redTokens,
    green_delta: params.greenTokens ?? 0,
    yellow_token_balance: nextYellow,
    red_token_balance: nextRed,
    green_token_balance: nextGreen,
    combined_balance: nextBalance,
    reading_date: params.readingDate,
    calculation_version: params.calculationVersion,
    trigger_source: params.triggerSource,
  };

  if (previousAudit.auditMode === "wallet_audit_log") {
    const auditUpsertResult = await admin
      .from("wallet_audit_log")
      .upsert(
        {
          user_id: params.userId,
          import_id: params.importId,
          yellow_delta: params.yellowTokens,
          red_delta: params.redTokens,
          green_delta: params.greenTokens ?? 0,
          source: "monthly_calculation",
          metadata,
          updated_at: utcNowIso(),
        },
        { onConflict: "user_id,import_id,source" },
      );

    if (auditUpsertResult.error) {
      throw new Error(auditUpsertResult.error.message);
    }
  } else {
    const txPayload = {
      user_id: params.userId,
      transaction_type: combinedDelta > 0 ? "earn" : "adjustment",
      amount: combinedDelta,
      description: "Legacy energy pipeline wallet reconciliation",
      status: "completed",
      metadata,
    };

    const txResult = previousAudit.id
      ? await admin.from("wallet_transactions").update(txPayload).eq("id", previousAudit.id)
      : await admin.from("wallet_transactions").insert(txPayload);

    if (txResult.error) {
      throw new Error(txResult.error.message);
    }
  }

  return {
    yellow_token: nextYellow,
    red_token: nextRed,
    green_token: nextGreen,
    balance: nextBalance,
  };
}

async function promoteEnergyReadingAndWallets(
  admin: SupabaseClient,
  params: {
    row: ImportRow;
    calculation: LegacyMonthlyCalculation;
    readingDate: string;
    triggerSource: string;
    calculationVersion: string;
  },
) {
  const linkedUserId = params.row.linked_user_id;
  if (!linkedUserId) {
    return false;
  }

  const existingReadingResult = await admin
    .from("energy_readings")
    .select("tokens_earned")
    .eq("user_id", linkedUserId)
    .eq("reading_date", params.readingDate)
    .maybeSingle();

  if (existingReadingResult.error) {
    throw new Error(existingReadingResult.error.message);
  }

  const previousTokens = round2(numeric(existingReadingResult.data?.tokens_earned));
  const nextTokens = round2(params.calculation.tokens_earned);
  const note = `Promoted from ${params.row.source_file_name ?? "dataset import"} (dataset_user_code=${params.row.dataset_user_code}, billing_cycle=${params.row.billing_cycle})`;

  const upsertResult = await admin.from("energy_readings").upsert(
    {
      user_id: linkedUserId,
      reading_date: params.readingDate,
      imported_kwh: params.calculation.imported_kwh,
      exported_kwh: params.calculation.exported_kwh,
      tokens_earned: nextTokens,
      notes: note,
    },
    {
      onConflict: "user_id,reading_date",
    },
  );

  if (upsertResult.error) {
    throw new Error(upsertResult.error.message);
  }

  await reconcileWalletAfterCalculation(admin, {
    userId: linkedUserId,
    yellowTokens: nextTokens,
    redTokens: round2(params.calculation.red_tokens),
    greenTokens: 0,
    importId: params.row.id,
    triggerSource: params.triggerSource,
    calculationVersion: params.calculationVersion,
    readingDate: params.readingDate,
  });

  return true;
}

export async function runEnergyPipeline(
  admin: SupabaseClient,
  options: EnergyPipelineRunOptions,
): Promise<EnergyPipelineRunSummary> {
  const runId = await startPipelineRun(admin, options);

  try {
    const settings = await fetchCoinSettings(admin);
    const rows = await fetchImportRows(admin, options.statuses, options.limit);

    if (rows.length === 0) {
      const skipped: EnergyPipelineRunSummary = {
        status: "skipped",
        rows_considered: 0,
        processed_count: 0,
        failed_count: 0,
        promoted_count: 0,
        error_summary: null,
        errors: [],
      };
      await finishPipelineRun(admin, runId, {
        ...skipped,
        metadata: { message: "No import rows matched the requested statuses." },
      });
      return skipped;
    }

    const historyRows = await fetchImportHistory(admin);
    const historyByMeter = new Map<string, ImportHistoryRow[]>();

    for (const item of historyRows) {
      if (!item.meter_id) {
        continue;
      }

      const key = String(item.meter_id);
      const current = historyByMeter.get(key) ?? [];
      current.push(item);
      historyByMeter.set(key, current);
    }

    let processedCount = 0;
    let failedCount = 0;
    let promotedCount = 0;
    const errors: EnergyPipelineRunSummary["errors"] = [];

    for (const row of rows) {
      const { readingDate, periodStart, periodEnd } = deriveDatesForRow(row, options.anchorDate);

      if (!options.dryRun) {
        const processingResult = await admin
          .from("energy_readings_import")
          .update({
            processing_status: "processing",
            processing_error: null,
          })
          .eq("id", row.id);

        if (processingResult.error) {
          failedCount += 1;
          errors.push({
            import_id: row.id,
            dataset_user_code: row.dataset_user_code,
            billing_cycle: row.billing_cycle,
            error: processingResult.error.message,
            trigger_source: options.triggerSource,
          });
          continue;
        }
      }

      try {
        const meterHistory = historyByMeter.get(String(row.meter_id ?? "")) ?? [];
        const historyImports = meterHistory
          .filter((item) => Number(item.billing_cycle ?? 0) <= Number(row.billing_cycle))
          .map((item) => item.imported_kwh);
        const greenPurchasedKwh = await fetchGreenPurchasedKwh(admin, {
          linkedUserId: row.linked_user_id,
          periodStart,
          periodEnd,
        });
        const calculation = calculateMonthlyResult({
          importedKwh: row.imported_kwh,
          exportedKwh: row.exported_kwh,
          historyImports,
          greenPurchasedKwh,
          redCoinRate: settings.red_coin_rate,
        });
        const nowIso = utcNowIso();
        const shouldPromote = Boolean(options.promote && row.linked_user_id && readingDate);

        const calculationPayload = {
          import_id: row.id,
          linked_user_id: row.linked_user_id,
          calculation_version: options.calculationVersion,
          logic_name: "ceb_legacy_port",
          net_kwh: calculation.net_kwh,
          tokens_earned: calculation.tokens_earned,
          estimated_bill: calculation.estimated_bill,
          yellow_tokens: calculation.yellow_tokens,
          red_tokens: calculation.red_tokens,
          green_cap_kwh: calculation.green_cap_kwh,
          green_purchased_kwh: calculation.green_purchased_kwh,
          remaining_green_cap_kwh: calculation.remaining_green_cap_kwh,
          settlement_required_kwh: calculation.settlement_required_kwh,
          reward_tier: calculation.reward_tier,
          result_payload: {
            imported_kwh: calculation.imported_kwh,
            exported_kwh: calculation.exported_kwh,
            yellow_tokens: calculation.yellow_tokens,
            red_tokens: calculation.red_tokens,
            green_cap_kwh: calculation.green_cap_kwh,
            green_purchased_kwh: calculation.green_purchased_kwh,
            remaining_green_cap_kwh: calculation.remaining_green_cap_kwh,
            settlement_required_kwh: calculation.settlement_required_kwh,
            formula: calculation.formula,
          },
        };

        const importPatch = {
          reading_date: readingDate,
          period_start: periodStart,
          period_end: periodEnd,
          processing_status: shouldPromote ? "promoted" : "calculated",
          calculation_version: options.calculationVersion,
          net_kwh: calculation.net_kwh,
          tokens_earned: calculation.tokens_earned,
          yellow_tokens: calculation.yellow_tokens,
          red_tokens: calculation.red_tokens,
          green_cap_kwh: calculation.green_cap_kwh,
          green_purchased_kwh: calculation.green_purchased_kwh,
          remaining_green_cap_kwh: calculation.remaining_green_cap_kwh,
          settlement_required_kwh: calculation.settlement_required_kwh,
          estimated_bill: calculation.estimated_bill,
          processing_error: null,
          calculated_at: nowIso,
          promoted_at: shouldPromote ? nowIso : null,
        };

        if (options.dryRun) {
          processedCount += 1;
          if (shouldPromote) {
            promotedCount += 1;
          }
          continue;
        }

        const calculationResult = await admin
          .from("energy_calculations")
          .upsert(calculationPayload, {
            onConflict: "import_id,calculation_version",
          });

        if (calculationResult.error) {
          throw new Error(calculationResult.error.message);
        }

        if (shouldPromote && readingDate) {
          await promoteEnergyReadingAndWallets(admin, {
            row,
            calculation,
            readingDate,
            triggerSource: options.triggerSource,
            calculationVersion: options.calculationVersion,
          });
          promotedCount += 1;
        }

        const importUpdateResult = await admin
          .from("energy_readings_import")
          .update(importPatch)
          .eq("id", row.id);

        if (importUpdateResult.error) {
          throw new Error(importUpdateResult.error.message);
        }

        processedCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown energy pipeline error.";

        if (!options.dryRun) {
          await admin
            .from("energy_readings_import")
            .update({
              processing_status: "failed",
              processing_error: message.slice(0, 1000),
            })
            .eq("id", row.id);
        }

        failedCount += 1;
        errors.push({
          import_id: row.id,
          dataset_user_code: row.dataset_user_code,
          billing_cycle: row.billing_cycle,
          error: message,
          trigger_source: options.triggerSource,
        });
      }
    }

    const summary: EnergyPipelineRunSummary = {
      status: failedCount > 0 ? "completed_with_errors" : "completed",
      rows_considered: rows.length,
      processed_count: processedCount,
      failed_count: failedCount,
      promoted_count: promotedCount,
      error_summary: errors[0]?.error?.slice(0, 1000) ?? null,
      errors,
    };

    await finishPipelineRun(admin, runId, {
      ...summary,
      metadata: { errors: errors.slice(0, 10) },
    });

    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Energy pipeline execution failed.";
    const failedSummary: EnergyPipelineRunSummary = {
      status: "failed",
      rows_considered: 0,
      processed_count: 0,
      failed_count: 0,
      promoted_count: 0,
      error_summary: message,
      errors: [],
    };

    await finishPipelineRun(admin, runId, {
      ...failedSummary,
      metadata: { fatal: true },
    });

    throw error;
  }
}
