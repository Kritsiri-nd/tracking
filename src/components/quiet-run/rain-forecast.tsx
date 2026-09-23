"use client";

import { CloudRain, CloudSun, CloudLightning, RefreshCw, Sun, Umbrella } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { fetchRainForecast, weatherLabel, type RainForecast } from "@/lib/weather";
import { GlassCard, cn } from "./shared";

function forecastIcon(code: number) {
  if (code >= 95) return CloudLightning;
  if (code >= 51 && code <= 82) return CloudRain;
  if (code === 0) return Sun;
  return CloudSun;
}

function formatTime(value: string, index: number) {
  if (index === 0) return "Now";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(`${value}:00+07:00`));
}

/** Small, key-free Bangkok rain outlook for the next three hours. */
export function RainForecast() {
  const [items, setItems] = useState<RainForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadForecast = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(false);
    try {
      setItems(await fetchRainForecast(signal));
    } catch (loadError) {
      if (!(loadError instanceof DOMException && loadError.name === "AbortError")) setError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadForecast(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadForecast]);

  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#dce4d7] text-[#53644e]"><Umbrella size={20} /></div>
          <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#85887f]">Rain outlook</p><h2 className="mt-1 text-xl font-medium tracking-[-.025em]">Next 3 hours</h2><p className="mt-1 text-sm text-[#777b73]">Bangkok · hourly forecast</p></div>
        </div>
        <button type="button" onClick={() => void loadForecast()} disabled={loading} className="tap inline-flex items-center gap-2 rounded-2xl border border-[#343b34]/10 bg-white/55 px-3 py-2 text-xs font-semibold text-[#687066] disabled:cursor-wait disabled:opacity-50"><RefreshCw size={14} className={cn(loading && "animate-spin")} />Refresh</button>
      </div>

      {loading && !items.length ? <div className="mt-5 grid gap-2 sm:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-[#eef1e8]" />)}</div> : error ? <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-[#a75b55]/15 bg-[#ead9d7]/45 px-4 py-3 text-sm text-[#92514d]"><span>Rain forecast is temporarily unavailable.</span><button type="button" onClick={() => void loadForecast()} className="tap rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold">Try again</button></div> : <div className="mt-5 grid gap-2 sm:grid-cols-3">{items.map((item, index) => { const Icon = forecastIcon(item.weatherCode); const rainMm = item.rainMm + item.showersMm; return <div key={item.time} className="rounded-2xl border border-[#343b34]/8 bg-white/48 p-3.5"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-[#586254]">{formatTime(item.time, index)}</span><Icon size={17} className="text-[#7f9277]" /></div><div className="mt-3 flex items-end justify-between gap-2"><div><div className="text-xl font-semibold text-[#30342f]">{Math.round(item.precipitationProbability)}%</div><div className="text-[11px] text-[#858880]">rain chance</div></div><div className="text-right"><div className="text-sm font-semibold text-[#586254]">{rainMm.toFixed(1)} mm</div><div className="text-[11px] text-[#858880]">{Math.round(item.temperatureC)}°C</div></div></div><div className="mt-2 truncate text-[11px] text-[#777b73]">{weatherLabel(item.weatherCode)}</div></div>; })}</div>}
      <p className="mt-4 text-[11px] text-[#92968d]">Forecast for Bangkok from Open-Meteo. Rain chance is an hourly estimate.</p>
    </GlassCard>
  );
}
