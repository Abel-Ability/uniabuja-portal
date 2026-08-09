"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Flag,
  Gauge,
  Sunrise,
  Sunset,
  Sun,
  Thermometer,
  Wind,
  type LucideIcon,
} from "lucide-react";

// Local Abuja date/time, weather, air quality, sunrise/sunset, the next
// academic-calendar event, the next public holiday and a 5-day forecast.
// Weather + air quality come from Open-Meteo (free, no API key) and are cached
// for 10 minutes; holidays (Nager date API) are cached for 24 hours.

export type AcademicNext = {
  title: string;
  entryType: string;
  startsOn: string;
  endsOn: string;
};

const LAGOS = "Africa/Lagos";

const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=8.935&longitude=7.086&timezone=Africa%2FLagos&forecast_days=5&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset";
const AIR_QUALITY_URL =
  "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=8.935&longitude=7.086&current=european_aqi,pm2_5";
const HOLIDAYS_URL = (year: number) =>
  `https://date.nager.at/api/v3/PublicHolidays/${year}/NG`;

const WEATHER_CACHE_KEY = "uap-weather";
const AIR_CACHE_KEY = "uap-air";
const HOLIDAYS_CACHE_KEY = "uap-holidays";
const CACHE_TTL_MS = 10 * 60 * 1000;
const HOLIDAY_TTL_MS = 24 * 60 * 60 * 1000;

const WEATHER: Record<number, { label: string; icon: LucideIcon; tone: string }> = {
  0: { label: "Clear sky", icon: Sun, tone: "text-amber-500" },
  1: { label: "Mostly clear", icon: Sun, tone: "text-amber-500" },
  2: { label: "Partly cloudy", icon: CloudSun, tone: "text-amber-500" },
  3: { label: "Overcast", icon: Cloud, tone: "text-slate-500" },
  45: { label: "Fog", icon: CloudFog, tone: "text-slate-400" },
  48: { label: "Icy fog", icon: CloudFog, tone: "text-slate-400" },
  51: { label: "Light drizzle", icon: CloudRain, tone: "text-sky-600" },
  53: { label: "Drizzle", icon: CloudRain, tone: "text-sky-600" },
  55: { label: "Dense drizzle", icon: CloudRain, tone: "text-sky-600" },
  56: { label: "Freezing drizzle", icon: CloudRain, tone: "text-sky-600" },
  57: { label: "Freezing drizzle", icon: CloudRain, tone: "text-sky-600" },
  61: { label: "Light rain", icon: CloudRain, tone: "text-sky-600" },
  63: { label: "Rain", icon: CloudRain, tone: "text-sky-600" },
  65: { label: "Heavy rain", icon: CloudRain, tone: "text-sky-600" },
  66: { label: "Freezing rain", icon: CloudRain, tone: "text-sky-600" },
  67: { label: "Freezing rain", icon: CloudRain, tone: "text-sky-600" },
  71: { label: "Light snow", icon: CloudSnow, tone: "text-slate-500" },
  73: { label: "Snow", icon: CloudSnow, tone: "text-slate-500" },
  75: { label: "Heavy snow", icon: CloudSnow, tone: "text-slate-500" },
  77: { label: "Snow grains", icon: CloudSnow, tone: "text-slate-500" },
  80: { label: "Light showers", icon: CloudRain, tone: "text-sky-600" },
  81: { label: "Showers", icon: CloudRain, tone: "text-sky-600" },
  82: { label: "Heavy showers", icon: CloudRain, tone: "text-sky-600" },
  85: { label: "Snow showers", icon: CloudSnow, tone: "text-slate-500" },
  86: { label: "Snow showers", icon: CloudSnow, tone: "text-slate-500" },
  95: { label: "Thunderstorm", icon: CloudLightning, tone: "text-violet-600" },
  96: { label: "Storm with hail", icon: CloudLightning, tone: "text-violet-600" },
  99: { label: "Severe storm", icon: CloudLightning, tone: "text-violet-600" },
};

const ENTRY_LABELS: Record<string, string> = {
  SESSION: "Session",
  REGISTRATION: "Registration",
  FEE_DEADLINE: "Fee deadline",
  EXAM: "Exams",
  HOLIDAY: "Break",
  CONVOCATION: "Convocation",
  NYSC: "NYSC",
  RESULT: "Results",
};

type WeatherPayload = {
  at?: number;
  current: {
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
  };
  daily: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
};

type AirPayload = { at?: number; current: { european_aqi?: number; pm2_5?: number } };
type Holiday = { date: string; localName: string };

// Generic cached JSON fetch: serve localStorage immediately, refresh in the
// background when stale, and keep serving old data if the network fails.
function useCachedJson<T extends { at?: number }>(
  key: string,
  url: string,
  ttlMs: number,
): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const readCache = (): T | null => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
      } catch {
        return null;
      }
    };
    const cached = readCache();
    if (cached && typeof cached.at === "number") {
      frame = requestAnimationFrame(() => {
        if (!cancelled) setData(cached);
      });
    }
    if (cached && typeof cached.at === "number" && Date.now() - cached.at < ttlMs) {
      return () => cancelAnimationFrame(frame);
    }

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        const fresh = { at: Date.now(), ...json } as T;
        setData(fresh);
        try {
          localStorage.setItem(key, JSON.stringify(fresh));
        } catch {
          /* storage unavailable — ignore */
        }
      })
      .catch(() => {
        /* keep serving stale cache */
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [key, url, ttlMs]);
  return data;
}

function useNextHoliday(): Holiday | null {
  const [holiday, setHoliday] = useState<Holiday | null>(null);
  useEffect(() => {
    let cancelled = false;
    const readCache = (): Holiday | null => {
      try {
        const raw = localStorage.getItem(HOLIDAYS_CACHE_KEY);
        return raw ? (JSON.parse(raw) as Holiday & { at: number }) : null;
      } catch {
        return null;
      }
    };
    const cached = readCache();
    if (cached && Date.now() - (cached as Holiday & { at: number }).at < HOLIDAY_TTL_MS) {
      const frame = requestAnimationFrame(() => {
        if (!cancelled) setHoliday({ date: cached.date, localName: cached.localName });
      });
      return () => cancelAnimationFrame(frame);
    }

    const year = new Date().getFullYear();
    Promise.all([fetch(HOLIDAYS_URL(year)), fetch(HOLIDAYS_URL(year + 1))])
      .then(([a, b]) => Promise.all([a.json(), b.json()]))
      .then(([current, next]: [Holiday[], Holiday[]]) => {
        if (cancelled) return;
        const now = Date.now();
        const upcoming = [...current, ...next]
          .map((h) => ({ ...h, ts: new Date(`${h.date}T00:00:00`).getTime() }))
          .filter((h) => h.ts > now)
          .sort((a, b) => a.ts - b.ts);
        if (!upcoming[0]) return;
        const pick = { date: upcoming[0].date, localName: upcoming[0].localName };
        setHoliday(pick);
        try {
          localStorage.setItem(HOLIDAYS_CACHE_KEY, JSON.stringify({ at: Date.now(), ...pick }));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return holiday;
}

function daysUntil(dateOnly: string): number {
  const target = new Date(`${dateOnly}T00:00:00`).getTime();
  return Math.max(1, Math.ceil((target - Date.now()) / 86_400_000));
}

function MiniStat({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-1.5 py-1 text-center">
      <p className="flex items-center justify-center gap-1 text-[10px] font-bold tabular-nums text-slate">
        <Icon className="h-3 w-3 text-brand-strong" aria-hidden="true" />
        {value}
      </p>
      <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide text-slate/50">
        {label}
      </p>
    </div>
  );
}

export function NowWidget({ academicNext }: { academicNext: AcademicNext | null }) {
  const [now, setNow] = useState<Date | null>(null);

  // Hydration-safe live clock in Abuja time; UTC badge is static (Lagos is UTC+1).
  useEffect(() => {
    const kick = setTimeout(() => setNow(new Date()), 0);
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearTimeout(kick);
      clearInterval(id);
    };
  }, []);

  const utcLabel = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: LAGOS,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    return (parts.find((p) => p.type === "timeZoneName")?.value ?? "UTC").replace("GMT", "UTC");
  }, []);

  const weather = useCachedJson<WeatherPayload>(WEATHER_CACHE_KEY, WEATHER_URL, CACHE_TTL_MS);
  const air = useCachedJson<AirPayload>(AIR_CACHE_KEY, AIR_QUALITY_URL, CACHE_TTL_MS);
  const holiday = useNextHoliday();

  const dateText = now
    ? new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: LAGOS,
      }).format(now)
    : null;
  const timeText = now
    ? new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: LAGOS,
      }).format(now)
    : null;

  const code = weather?.current.weather_code ?? 0;
  const temp = weather?.current.temperature_2m ?? null;
  const feelsLike = weather?.current.apparent_temperature ?? null;
  const humidity = weather?.current.relative_humidity_2m ?? null;
  const wind = weather?.current.wind_speed_10m ?? null;

  const aqi = air?.current.european_aqi ?? null;
  const aqiInfo =
    aqi === null
      ? null
      : aqi <= 20
        ? { label: "Good", tone: "text-green-600" }
        : aqi <= 40
          ? { label: "Fair", tone: "text-lime-600" }
          : aqi <= 60
            ? { label: "Moderate", tone: "text-amber-600" }
            : aqi <= 80
              ? { label: "Poor", tone: "text-orange-600" }
              : aqi <= 100
                ? { label: "Very poor", tone: "text-red-600" }
                : { label: "Hazardous", tone: "text-red-700" };

  const daily = weather?.daily;
  const forecast = (daily?.time ?? []).map((day, i) => {
    const dailyCode = daily?.weather_code?.[i] ?? 0;
    const w = WEATHER[dailyCode] ?? { label: "Weather", icon: Sun, tone: "text-amber-500" };
    return {
      day: new Date(`${day}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short" }),
      icon: w.icon,
      tone: w.tone,
      high: daily?.temperature_2m_max?.[i],
      low: daily?.temperature_2m_min?.[i],
    };
  });

  const sunrise = weather?.daily.sunrise?.[0]?.slice(11, 16);
  const sunset = weather?.daily.sunset?.[0]?.slice(11, 16);

  const weatherInfo = WEATHER[code] ?? { label: "Weather", icon: Sun, tone: "text-amber-500" };
  const WeatherIcon = weatherInfo.icon;

  const entryLabel = academicNext ? (ENTRY_LABELS[academicNext.entryType] ?? "Upcoming") : null;

  return (
    <aside
      aria-label="Abuja date, time, weather, air quality and key dates"
      className="pointer-events-none fixed right-4 top-24 z-30 hidden w-80 rounded-2xl border border-white/70 bg-white/90 py-4 pl-4 pr-3 text-slate shadow-lg backdrop-blur-md md:block"
    >
      {/* Date / time */}
      <div className="text-right">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate/60">
            {dateText ?? "—"}
          </span>
          <span className="rounded-full border border-slate/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate/60">
            {utcLabel}
          </span>
        </div>
        <p className="font-head text-3xl font-bold leading-none tabular-nums">
          {timeText ?? "–:––"}
        </p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-brand-strong">
          Abuja, Nigeria
        </p>
      </div>

      {/* Current conditions */}
      <div className="mt-3 flex items-center gap-2 border-t border-slate/10 pt-3">
        <WeatherIcon className={`h-7 w-7 ${weatherInfo.tone}`} aria-hidden="true" />
        <div className="flex-1">
          <p className="font-head text-xl font-bold leading-none tabular-nums">
            {temp !== null ? `${Math.round(temp)}°C` : "—"}
          </p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate/60">
            {weatherInfo.label}
          </p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <MiniStat icon={Thermometer} value={feelsLike !== null ? `${Math.round(feelsLike)}°` : "—"} label="Feels" />
        <MiniStat icon={Droplets} value={humidity !== null ? `${Math.round(humidity)}%` : "—"} label="Humidity" />
        <MiniStat icon={Wind} value={wind !== null ? `${Math.round(wind)} km/h` : "—"} label="Wind" />
      </div>

      {sunrise && sunset ? (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <MiniStat icon={Sunrise} value={sunrise} label="Sunrise" />
          <MiniStat icon={Sunset} value={sunset} label="Sunset" />
        </div>
      ) : null}

      {aqiInfo && aqi !== null ? (
        <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate">
            <Gauge className="h-4 w-4 text-brand-strong" aria-hidden="true" />
            Air quality
          </span>
          <span className={`font-head text-sm font-bold tabular-nums ${aqiInfo.tone}`}>
            {aqi} · {aqiInfo.label}
          </span>
        </div>
      ) : null}

      {/* Key dates */}
      {academicNext || holiday ? (
        <div className="mt-3 space-y-1.5 border-t border-slate/10 pt-3">
          {academicNext ? (
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate">
                <CalendarDays className="h-4 w-4 shrink-0 text-brand-strong" aria-hidden="true" />
                <span className="truncate">{academicNext.title}</span>
              </span>
              <span className="shrink-0 rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-bold text-brand-strong">
                {entryLabel} · {daysUntil(academicNext.startsOn)}d
              </span>
            </div>
          ) : null}
          {holiday ? (
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate">
                <Flag className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                <span className="truncate">{holiday.localName}</span>
              </span>
              <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">
                {daysUntil(holiday.date)}d
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 5-day forecast */}
      {forecast.length > 0 ? (
        <div className="mt-3 grid grid-cols-5 gap-1 border-t border-slate/10 pt-3 text-center">
          {forecast.map((f, i) => (
            <div key={i}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate/60">
                {f.day}
              </p>
              <f.icon className={`mx-auto h-4 w-4 ${f.tone}`} aria-hidden="true" />
              <p className="mt-0.5 text-[10px] font-bold tabular-nums text-slate">
                {f.high !== undefined ? `${Math.round(f.high)}°` : "—"}
              </p>
              <p className="text-[10px] tabular-nums text-slate/60">
                {f.low !== undefined ? `${Math.round(f.low)}°` : "—"}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
