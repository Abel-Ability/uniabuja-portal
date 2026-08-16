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

// Minimal widget: local Abuja date, live clock and current temperature.
// Temperature comes from Open-Meteo (free, no API key) and is cached for
// 10 minutes in localStorage so the widget still shows the last reading.

const LAGOS = "Africa/Lagos";

const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=8.935&longitude=7.086&timezone=Africa%2FLagos&current=temperature_2m,weather_code";

const WEATHER_CACHE_KEY = "uap-weather-simple";
const CACHE_TTL_MS = 10 * 60 * 1000;

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

type WeatherPayload = {
  at?: number;
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
};

const isWeatherPayload = (v: WeatherPayload): boolean =>
  typeof v?.current === "object" && typeof v.current?.temperature_2m === "number";

function useTemperature(): WeatherPayload | null {
  const [data, setData] = useState<WeatherPayload | null>(null);
  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const readCache = (): WeatherPayload | null => {
      try {
        const raw = localStorage.getItem(WEATHER_CACHE_KEY);
        if (!raw) return null;
        const value = JSON.parse(raw) as WeatherPayload;
        return isWeatherPayload(value) ? value : null;
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
    if (cached && typeof cached.at === "number" && Date.now() - cached.at < CACHE_TTL_MS) {
      return () => cancelAnimationFrame(frame);
    }

    fetch(WEATHER_URL)
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        const fresh = { at: Date.now(), ...json } as WeatherPayload;
        if (!isWeatherPayload(fresh)) return;
        setData(fresh);
        try {
          localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(fresh));
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
  }, []);
  return data;
}

export function NowWidget() {
  const [now, setNow] = useState<Date | null>(null);

  // Hydration-safe live clock in Abuja time.
  useEffect(() => {
    const kick = setTimeout(() => setNow(new Date()), 0);
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearTimeout(kick);
      clearInterval(id);
    };
  }, []);

  const weather = useTemperature();

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

  const code = weather?.current?.weather_code ?? 0;
  const temp = weather?.current?.temperature_2m ?? null;
  const weatherInfo = WEATHER[code] ?? { label: "Weather", icon: Sun, tone: "text-amber-500" };
  const WeatherIcon = weatherInfo.icon;

  return (
    <aside
      aria-label="Abuja date, time and temperature"
      className="pointer-events-none fixed right-20 top-44 z-30 hidden w-32 bg-transparent py-4 pl-4 pr-4 text-slate md:block"
    >
      <div className="text-right">
        <span className="text-xs font-semibold uppercase tracking-widest text-blue-500/70">
          {dateText ?? "—"}
        </span>
        <p className="mt-1 font-head text-4xl font-bold leading-none tabular-nums text-blue-500">
          {timeText ?? "–:––"}
        </p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-gold">
          Abuja, Nigeria
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/15 pt-3">
        <div className="flex items-center gap-2">
          <WeatherIcon className={`h-6 w-6 ${weatherInfo.tone}`} aria-hidden="true" />
          <span className="font-head text-2xl font-bold leading-none tabular-nums text-red-500">
            {temp !== null ? `${Math.round(temp)}°C` : "—"}
          </span>
        </div>
      </div>
    </aside>
  );
}
