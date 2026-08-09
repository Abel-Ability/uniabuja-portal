"use client";

import { useEffect, useState } from "react";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  type LucideIcon,
} from "lucide-react";

// Local date/time plus Abuja weather for the landing page. Weather is fetched
// from Open-Meteo (free, no API key, CORS-enabled) and cached for 10 minutes so
// returning visitors don't hit the API on every load.

const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=8.935&longitude=7.086&current=temperature_2m,weather_code";

const WEATHER_CACHE_KEY = "uap-weather";
const WEATHER_TTL_MS = 10 * 60 * 1000;
const STALE_WEATHER_MS = 6 * 60 * 60 * 1000;

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

type CachedWeather = { at: number; temp: number; code: number };

export function NowWidget() {
  const [now, setNow] = useState<Date | null>(null);
  const [temp, setTemp] = useState<number | null>(null);
  const [code, setCode] = useState(0);

  // Hydration-safe live clock: server and first client render agree (null),
  // then the real time starts ticking right after mount.
  useEffect(() => {
    const kick = setTimeout(() => setNow(new Date()), 0);
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearTimeout(kick);
      clearInterval(id);
    };
  }, []);

  // Abuja weather, cached in localStorage so we don't hit Open-Meteo each visit.
  useEffect(() => {
    let cancelled = false;

    const readCache = (): CachedWeather | null => {
      try {
        const raw = localStorage.getItem(WEATHER_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as CachedWeather;
        return parsed && typeof parsed.temp === "number" ? parsed : null;
      } catch {
        return null;
      }
    };

    const apply = (w: CachedWeather) => {
      setTemp(w.temp);
      setCode(w.code);
    };

    const cached = readCache();
    if (cached && Date.now() - cached.at < WEATHER_TTL_MS) {
      apply(cached);
      return;
    }

    fetch(WEATHER_URL)
      .then((res) => {
        if (!res.ok) throw new Error("weather fetch failed");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const t = data?.current?.temperature_2m;
        const c = data?.current?.weather_code;
        if (typeof t !== "number") return;
        const w = { at: Date.now(), temp: t, code: typeof c === "number" ? c : 0 };
        apply(w);
        try {
          localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(w));
        } catch {
          /* storage unavailable — ignore */
        }
      })
      .catch(() => {
        if (cached && Date.now() - cached.at < STALE_WEATHER_MS) apply(cached);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const dateText = now
    ? now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    : null;
  const timeText = now
    ? now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : null;
  const weather = WEATHER[code] ?? { label: "Weather", icon: Sun, tone: "text-amber-500" };
  const WeatherIcon = weather.icon;

  return (
    <aside
      aria-label="Local date, time and weather in Abuja"
      className="pointer-events-none fixed right-4 top-24 z-30 hidden items-center gap-3 rounded-2xl border border-white/70 bg-white/85 py-4 pl-4 pr-3 text-slate shadow-lg backdrop-blur-md md:flex"
    >
      <div className="text-right leading-tight">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate/60">
          {dateText ?? "—"}
        </p>
        <p className="font-head text-3xl font-bold leading-none tabular-nums">
          {timeText ?? "–:––"}
        </p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-brand-strong">
          Abuja, Nigeria
        </p>
      </div>
      <div className="flex items-center gap-1.5 border-l border-slate/15 pl-3">
        <WeatherIcon className={`h-5 w-5 ${weather.tone}`} aria-hidden="true" />
        <span className="text-base font-semibold tabular-nums">
          {temp !== null ? `${Math.round(temp)}°C` : "—"}
        </span>
      </div>
      <span className="sr-only">{weather.label}</span>
    </aside>
  );
}
