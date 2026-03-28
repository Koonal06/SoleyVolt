import { useEffect, useState } from "react";
import {
  BadgeDollarSign,
  Sun,
  Zap,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Leaf,
  TriangleAlert,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  getMyEnergyReadings,
  getMyPortalSummary,
  getMyTransactions,
  type EnergyReadingRow,
  type UserPortalSummaryRow,
  type WalletTransactionRow,
} from "../../lib/supabase-data";
import { useAppLanguage } from "../lib/language";
import { getLanguageLocale, getStatusLabel, getUserPortalCopy } from "../lib/user-portal-copy";
import { useAuth } from "../providers/AuthProvider";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatAmount(value: number) {
  return numberFormatter.format(value);
}

function formatRelativeDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildChartData(readings: EnergyReadingRow[], locale: string) {
  return [...readings]
    .reverse()
    .map((reading) => ({
      day: new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date(reading.reading_date)),
      import: Number(reading.imported_kwh),
      export: Number(reading.exported_kwh),
    }));
}

function getTransactionLabel(tx: WalletTransactionRow, copy: ReturnType<typeof getUserPortalCopy>) {
  if (tx.transaction_type === "receive") {
    return tx.description || copy.dashboard.incomingTransfer;
  }

  if (tx.transaction_type === "send") {
    return tx.description || copy.dashboard.outgoingTransfer;
  }

  return tx.description || copy.dashboard.solarReward;
}

export function Dashboard() {
  const { profile, userType } = useAuth();
  const language = useAppLanguage(profile?.language);
  const copy = getUserPortalCopy(language);
  const locale = getLanguageLocale(language);
  const [summary, setSummary] = useState<UserPortalSummaryRow | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionRow[]>([]);
  const [readings, setReadings] = useState<EnergyReadingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        setIsLoading(true);
        setError(null);

        const [summaryData, transactionData, readingData] = await Promise.all([
          getMyPortalSummary(),
          getMyTransactions(5),
          getMyEnergyReadings(6),
        ]);

        if (!active) {
          return;
        }

        setSummary(summaryData);
        setTransactions(transactionData);
        setReadings(readingData);
      } catch (err) {
        if (!active) {
          return;
        }

        setError(err instanceof Error ? err.message : copy.dashboard.loadError);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const totalImported = Number(summary?.total_imported_kwh ?? 0);
  const totalExported = Number(summary?.total_exported_kwh ?? 0);
  const netEnergy = Number(summary?.net_energy_kwh ?? 0);
  const redCoins = Number(summary?.red_coins ?? 0);
  const yellowCoins = Number(summary?.yellow_coins ?? 0);
  const greenCoins = Number(summary?.green_coins ?? 0);
  const billEstimate = Number(summary?.bill_estimate ?? 0);
  const lastReading = readings[0];
  const chartData = buildChartData(readings, locale);
  const showOnboardingState = !isLoading && !error && !summary && readings.length === 0 && transactions.length === 0;

  const stats =
    userType === "consumer"
      ? [
          {
            icon: Zap,
            label: copy.dashboard.importedEnergy,
            value: `${formatAmount(totalImported)} kWh`,
            change: lastReading ? `${formatAmount(Number(lastReading.imported_kwh))} kWh ${copy.dashboard.latestImport}` : copy.dashboard.noReadingsYet,
            positive: false,
            color: "blue",
          },
          {
            icon: TriangleAlert,
            label: copy.dashboard.redCoins,
            value: `${formatAmount(redCoins)} RC`,
            change: copy.dashboard.consumptionLinked,
            positive: false,
            color: "amber",
          },
          {
            icon: BadgeDollarSign,
            label: copy.dashboard.billEstimate,
            value: `${formatAmount(billEstimate)} RC`,
            change: `${copy.dashboard.greenCoinReduction} ${formatAmount(greenCoins)} GC`,
            positive: true,
            color: "emerald",
          },
        ]
      : userType === "producer"
        ? [
            {
              icon: Sun,
              label: copy.dashboard.exportedEnergy,
              value: `${formatAmount(totalExported)} kWh`,
              change: lastReading ? `+${formatAmount(Number(lastReading.tokens_earned))} YC ${copy.dashboard.latestReward}` : copy.dashboard.noReadingsYet,
              positive: true,
              color: "amber",
            },
            {
              icon: Leaf,
              label: copy.dashboard.yellowCoinsEarned,
              value: `${formatAmount(yellowCoins)} YC`,
              change: `${copy.dashboard.storedCredits} ${formatAmount(Number(summary?.lifetime_earned ?? 0))}`,
              positive: true,
              color: "emerald",
            },
            {
              icon: Wallet,
              label: copy.dashboard.walletBalance,
              value: `${formatAmount(Number(summary?.balance ?? 0))} SLT`,
              change: `${copy.dashboard.lifetimeEarned} ${formatAmount(Number(summary?.lifetime_earned ?? 0))}`,
              positive: true,
              color: "blue",
            },
          ]
        : [
            {
              icon: Zap,
              label: copy.dashboard.importedEnergy,
              value: `${formatAmount(totalImported)} kWh`,
              change: copy.dashboard.consumptionPressure,
              positive: false,
              color: "blue",
            },
            {
              icon: Sun,
              label: copy.dashboard.exportedEnergy,
              value: `${formatAmount(totalExported)} kWh`,
              change: `${copy.dashboard.yellowCoins} ${formatAmount(yellowCoins)} YC`,
              positive: true,
              color: "amber",
            },
            {
              icon: Wallet,
              label: copy.dashboard.netEnergy,
              value: `${formatAmount(netEnergy)} kWh`,
              change: `${copy.dashboard.billEstimate} ${formatAmount(billEstimate)} RC`,
              positive: netEnergy >= 0,
              color: "emerald",
            },
          ];

  const chartTitle =
    userType === "consumer"
      ? copy.dashboard.chartConsumer
      : userType === "producer"
        ? copy.dashboard.chartProducer
        : copy.dashboard.chartProsumer;
  const showExportLine = userType !== "consumer";
  const showImportLine = userType !== "producer";
  const summaryTitle =
    userType === "consumer"
      ? copy.dashboard.summaryConsumer
      : userType === "producer"
        ? copy.dashboard.summaryProducer
        : copy.dashboard.summaryProsumer;

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {showOnboardingState && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
          {copy.dashboard.onboarding}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                  stat.color === "amber"
                    ? "bg-amber-100"
                    : stat.color === "blue"
                      ? "bg-blue-100"
                      : "bg-emerald-100"
                }`}
              >
                <stat.icon
                  className={`h-6 w-6 ${
                    stat.color === "amber"
                      ? "text-amber-600"
                      : stat.color === "blue"
                        ? "text-blue-600"
                        : "text-emerald-600"
                  }`}
                />
              </div>
              <div className={`flex items-center gap-1 text-sm ${stat.positive ? "text-emerald-600" : "text-blue-700"}`}>
                {stat.positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span>{stat.change}</span>
              </div>
            </div>
            <h3 className="mb-1 text-blue-900">{isLoading ? "Loading..." : stat.value}</h3>
            <p className="text-sm text-gray-600">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-6 text-blue-900">{chartTitle}</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} />
              <Legend />
              {showImportLine ? <Line type="monotone" dataKey="import" stroke="#1e3a8a" strokeWidth={2} name={copy.dashboard.importedEnergyLine} /> : null}
              {showExportLine ? <Line type="monotone" dataKey="export" stroke="#fbbf24" strokeWidth={2} name={copy.dashboard.exportedEnergyLine} /> : null}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-600">
            {isLoading ? copy.dashboard.loadingReadings : copy.dashboard.noReadings}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-blue-900">{summaryTitle}</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <p>{copy.dashboard.importedEnergyLabel}: {formatAmount(totalImported)} kWh</p>
            <p>{copy.dashboard.exportedEnergyLabel}: {formatAmount(totalExported)} kWh</p>
            <p>{copy.dashboard.redCoins}: {formatAmount(redCoins)} RC</p>
            <p>{copy.dashboard.yellowCoins}: {formatAmount(yellowCoins)} YC</p>
            <p>{copy.dashboard.greenCoinOption}: {formatAmount(greenCoins)} GC</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-blue-900">
            {userType === "producer" ? copy.dashboard.guidanceProducer : userType === "consumer" ? copy.dashboard.guidanceConsumer : copy.dashboard.guidanceProsumer}
          </h3>
          <div className="space-y-3 text-sm text-gray-600">
            {userType === "producer" ? (
              <>
                <p>{copy.dashboard.guidanceProducerA}</p>
                <p>{copy.dashboard.guidanceProducerB}</p>
              </>
            ) : userType === "consumer" ? (
              <>
                <p>{copy.dashboard.guidanceConsumerA}</p>
                <p>{copy.dashboard.guidanceConsumerB}</p>
              </>
            ) : (
              <>
                <p>{copy.dashboard.guidanceProsumerA}</p>
                <p>{copy.dashboard.guidanceProsumerB}</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-blue-900">{userType === "producer" ? copy.dashboard.activityProducer : copy.dashboard.activityDefault}</h3>
          <div className="flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-1.5 text-sm text-emerald-700">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            {copy.dashboard.liveBackendData}
          </div>
        </div>
        <div className="space-y-4">
          {transactions.length > 0 ? (
            transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      tx.transaction_type === "receive"
                        ? "bg-emerald-100"
                        : tx.transaction_type === "send"
                          ? "bg-blue-100"
                          : "bg-amber-100"
                    }`}
                  >
                    {tx.transaction_type === "receive" ? (
                      <ArrowDownRight className="h-5 w-5 text-emerald-600" />
                    ) : tx.transaction_type === "send" ? (
                      <ArrowUpRight className="h-5 w-5 text-blue-600" />
                    ) : (
                      <Sun className="h-5 w-5 text-amber-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-blue-900">{getTransactionLabel(tx, copy)}</p>
                    <p className="text-sm text-gray-500">{formatRelativeDate(tx.created_at, locale)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={tx.amount >= 0 ? "text-emerald-600" : "text-blue-900"}>
                    {tx.amount >= 0 ? "+" : ""}
                    {formatAmount(Number(tx.amount))} SLT
                  </p>
                  <p className="text-xs capitalize text-gray-500">{getStatusLabel(language, tx.status)}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-600">
              {isLoading ? copy.dashboard.loadingTransactions : copy.dashboard.noTransactions}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
