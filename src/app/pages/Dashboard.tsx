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
import { useAuth } from "../providers/AuthProvider";

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatAmount(value: number) {
  return numberFormatter.format(value);
}

function formatRelativeDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildChartData(readings: EnergyReadingRow[]) {
  return [...readings]
    .reverse()
    .map((reading) => ({
      day: new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(reading.reading_date)),
      import: Number(reading.imported_kwh),
      export: Number(reading.exported_kwh),
    }));
}

function getTransactionLabel(tx: WalletTransactionRow) {
  if (tx.transaction_type === "receive") {
    return tx.description || "Incoming transfer";
  }

  if (tx.transaction_type === "send") {
    return tx.description || "Outgoing transfer";
  }

  return tx.description || "Solar production reward";
}

export function Dashboard() {
  const { userType } = useAuth();
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

        setError(err instanceof Error ? err.message : "Unable to load dashboard data.");
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
  const chartData = buildChartData(readings);

  const stats =
    userType === "consumer"
      ? [
          {
            icon: Zap,
            label: "Imported Energy",
            value: `${formatAmount(totalImported)} kWh`,
            change: lastReading ? `${formatAmount(Number(lastReading.imported_kwh))} kWh latest import` : "No readings yet",
            positive: false,
            color: "blue",
          },
          {
            icon: TriangleAlert,
            label: "Red Coins",
            value: `${formatAmount(redCoins)} RC`,
            change: "Consumption-linked bill obligation",
            positive: false,
            color: "amber",
          },
          {
            icon: BadgeDollarSign,
            label: "Bill Estimate",
            value: `${formatAmount(billEstimate)} RC`,
            change: `Green Coin reduction ${formatAmount(greenCoins)} GC`,
            positive: true,
            color: "emerald",
          },
        ]
      : userType === "producer"
        ? [
            {
              icon: Sun,
              label: "Exported Energy",
              value: `${formatAmount(totalExported)} kWh`,
              change: lastReading ? `+${formatAmount(Number(lastReading.tokens_earned))} YC latest reward` : "No readings yet",
              positive: true,
              color: "amber",
            },
            {
              icon: Leaf,
              label: "Yellow Coins Earned",
              value: `${formatAmount(yellowCoins)} YC`,
              change: `Stored credits ${formatAmount(Number(summary?.lifetime_earned ?? 0))}`,
              positive: true,
              color: "emerald",
            },
            {
              icon: Wallet,
              label: "Wallet Balance",
              value: `${formatAmount(Number(summary?.balance ?? 0))} SLT`,
              change: `Lifetime earned ${formatAmount(Number(summary?.lifetime_earned ?? 0))}`,
              positive: true,
              color: "blue",
            },
          ]
        : [
            {
              icon: Zap,
              label: "Imported Energy",
              value: `${formatAmount(totalImported)} kWh`,
              change: "Consumption pressure",
              positive: false,
              color: "blue",
            },
            {
              icon: Sun,
              label: "Exported Energy",
              value: `${formatAmount(totalExported)} kWh`,
              change: `Yellow Coins ${formatAmount(yellowCoins)} YC`,
              positive: true,
              color: "amber",
            },
            {
              icon: Wallet,
              label: "Net Energy",
              value: `${formatAmount(netEnergy)} kWh`,
              change: `Bill estimate ${formatAmount(billEstimate)} RC`,
              positive: netEnergy >= 0,
              color: "emerald",
            },
          ];

  const chartTitle =
    userType === "consumer"
      ? "Consumption trend"
      : userType === "producer"
        ? "Production trend"
        : "Import vs export balance";
  const showExportLine = userType !== "consumer";
  const showImportLine = userType !== "producer";
  const summaryTitle =
    userType === "consumer"
      ? "Bill reduction summary"
      : userType === "producer"
        ? "Stored production credits"
        : "Net energy and coin summary";

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
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
              {showImportLine ? <Line type="monotone" dataKey="import" stroke="#1e3a8a" strokeWidth={2} name="Import (kWh)" /> : null}
              {showExportLine ? <Line type="monotone" dataKey="export" stroke="#fbbf24" strokeWidth={2} name="Export (kWh)" /> : null}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-600">
            {isLoading ? "Loading energy readings..." : "No energy readings yet. Add readings in Supabase to see your live chart."}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-blue-900">{summaryTitle}</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <p>Imported energy: {formatAmount(totalImported)} kWh</p>
            <p>Exported energy: {formatAmount(totalExported)} kWh</p>
            <p>Red Coins: {formatAmount(redCoins)} RC</p>
            <p>Yellow Coins: {formatAmount(yellowCoins)} YC</p>
            <p>Green Coin option: {formatAmount(greenCoins)} GC</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-blue-900">
            {userType === "producer" ? "Producer guidance" : userType === "consumer" ? "Consumer guidance" : "Prosumer guidance"}
          </h3>
          <div className="space-y-3 text-sm text-gray-600">
            {userType === "producer" ? (
              <>
                <p>Production rewards are highlighted first so you can track surplus export performance.</p>
                <p>Bill-oriented consumption widgets are intentionally de-emphasized here.</p>
              </>
            ) : userType === "consumer" ? (
              <>
                <p>Your dashboard focuses on imported energy, Red Coin obligation, and bill reduction tools.</p>
                <p>Production charts are minimized because they are not central to a consumer flow.</p>
              </>
            ) : (
              <>
                <p>Your dashboard balances both sides of the energy profile so you can see obligation and rewards together.</p>
                <p>This is the fullest portal mode, combining billing, credits, and net energy position.</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-blue-900">{userType === "producer" ? "Production and wallet activity" : "Transaction and activity history"}</h3>
          <div className="flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-1.5 text-sm text-emerald-700">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Live backend data
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
                    <p className="text-blue-900">{getTransactionLabel(tx)}</p>
                    <p className="text-sm text-gray-500">{formatRelativeDate(tx.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={tx.amount >= 0 ? "text-emerald-600" : "text-blue-900"}>
                    {tx.amount >= 0 ? "+" : ""}
                    {formatAmount(Number(tx.amount))} SLT
                  </p>
                  <p className="text-xs capitalize text-gray-500">{tx.status}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-600">
              {isLoading ? "Loading transactions..." : "No transactions yet."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
