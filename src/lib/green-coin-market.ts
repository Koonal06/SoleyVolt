import { useEffect, useMemo, useState } from "react";
import type { CoinSettingsRow } from "./supabase-data";
import { getCoinSettings } from "./supabase-data";
import { supabase } from "./supabase";

const DEFAULT_GREEN_COIN_PRICE = 1.25;
const PUBLIC_COIN_SETTINGS_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/server/public/coin-settings`
  : "";
const PUBLIC_API_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "";
const MARKET_TIME_ZONE = "Indian/Mauritius";
const MINUTES_PER_DAY = 24 * 60;
const NIGHT_PEAK_MINUTE = 21 * 60;
const DAILY_SWING = 0.12;
const MICRO_SWING = 0.015;
const MIN_MULTIPLIER = 0.82;
const MAX_MULTIPLIER = 1.18;
const TICK_INTERVAL_MS = 30_000;

type MarketPhase = "night" | "morning" | "day" | "evening";
type CoinSettingsSource = "supabase" | "public-api" | "default";

function roundToCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function readMarketClock(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TIME_ZONE,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const second = Number(parts.find((part) => part.type === "second")?.value ?? "0");

  return {
    hour,
    minute,
    second,
    clockLabel: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} Mauritius`,
  };
}

export function getGreenCoinMarket(basePrice: number, date = new Date()) {
  const normalizedBasePrice =
    Number.isFinite(basePrice) && basePrice >= 0 ? basePrice : DEFAULT_GREEN_COIN_PRICE;
  const clock = readMarketClock(date);
  const minutesOfDay = clock.hour * 60 + clock.minute + clock.second / 60;
  const dailyRadians = ((minutesOfDay - NIGHT_PEAK_MINUTE) / MINUTES_PER_DAY) * Math.PI * 2;
  const microRadians = (minutesOfDay / 360) * Math.PI * 2;
  const multiplier = Math.min(
    MAX_MULTIPLIER,
    Math.max(MIN_MULTIPLIER, 1 + DAILY_SWING * Math.cos(dailyRadians) + MICRO_SWING * Math.sin(microRadians)),
  );
  const livePrice = roundToCents(normalizedBasePrice * multiplier);
  const changePercent = Math.round((multiplier - 1) * 1000) / 10;
  const phase: MarketPhase =
    clock.hour >= 19 || clock.hour < 5 ? "night" : clock.hour < 11 ? "morning" : clock.hour < 17 ? "day" : "evening";

  return {
    basePrice: roundToCents(normalizedBasePrice),
    livePrice,
    changePercent,
    multiplier,
    phase,
    clockLabel: clock.clockLabel,
    phaseLabel:
      phase === "night"
        ? "Night demand"
        : phase === "morning"
          ? "Morning cooldown"
          : phase === "day"
            ? "Midday balance"
            : "Evening ramp",
    trendLabel: changePercent >= 0 ? "above base" : "below base",
  };
}

export function useCoinSettings() {
  const [settings, setSettings] = useState<CoinSettingsRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<CoinSettingsSource>("default");

  async function fetchPublicCoinSettings() {
    if (!PUBLIC_COIN_SETTINGS_URL) {
      return null;
    }

    const response = await fetch(PUBLIC_COIN_SETTINGS_URL, {
      headers: PUBLIC_API_KEY ? { apikey: PUBLIC_API_KEY } : undefined,
    });

    const payload = (await response.json().catch(() => null)) as CoinSettingsRow | { error?: string } | null;

    if (!response.ok) {
      throw new Error((payload as { error?: string } | null)?.error ?? "Unable to load public coin settings.");
    }

    return payload as CoinSettingsRow;
  }

  async function refreshSettings() {
    setIsLoading(true);
    try {
      const data = await getCoinSettings();

      if (data) {
        setSettings(data);
        setSource("supabase");
        setError(null);
        return data;
      }
    } catch (err) {
      try {
        const fallbackData = await fetchPublicCoinSettings();
        setSettings(fallbackData);
        setSource(fallbackData ? "public-api" : "default");
        setError(null);
        return fallbackData;
      } catch (fallbackError) {
        const message =
          fallbackError instanceof Error ? fallbackError.message : "Unable to load coin settings.";
        setError(message);
        setSource("default");
        throw fallbackError;
      } finally {
        setIsLoading(false);
      }
    }

    try {
      const fallbackData = await fetchPublicCoinSettings();
      setSettings(fallbackData);
      setSource(fallbackData ? "public-api" : "default");
      setError(null);
      return fallbackData;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load coin settings.";
      setError(message);
      setSource("default");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    let pollInterval = 0;

    void refreshSettings().catch(() => undefined);

    pollInterval = window.setInterval(() => {
      if (!active) {
        return;
      }

      void refreshSettings().catch(() => undefined);
    }, TICK_INTERVAL_MS);

    if (!supabase) {
      return () => {
        active = false;
        window.clearInterval(pollInterval);
      };
    }

    const channel = supabase
      .channel(`coin-settings-live-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coin_settings",
          filter: "id=eq.true",
        },
        (payload) => {
          if (!active) {
            return;
          }

          if (payload.eventType === "DELETE") {
            setSettings(null);
            return;
          }

          setSettings(payload.new as CoinSettingsRow);
          setError(null);
          setIsLoading(false);
        },
      )
      .subscribe();

    return () => {
      active = false;
      window.clearInterval(pollInterval);
      void channel.unsubscribe();
    };
  }, []);

  return { settings, isLoading, error, refreshSettings, source };
}

export function useGreenCoinMarket() {
  const { settings, isLoading, error, source } = useCoinSettings();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, TICK_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const market = useMemo(
    () => getGreenCoinMarket(Number(settings?.green_coin_unit_price ?? DEFAULT_GREEN_COIN_PRICE), now),
    [settings?.green_coin_unit_price, now],
  );

  return {
    ...market,
    settings,
    isLoading,
    error,
    source,
  };
}
