"use client";

import { CloudLightning, CloudRain, CloudSun, Pause, Play, RefreshCw, Sun, Thermometer, Umbrella, Wind } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWeatherExplorerForecast, type WeatherExplorerForecast, type WeatherReading } from "@/lib/weather";
import { GlassCard, cn } from "./shared";

type WeatherLayer = "rain" | "temperature" | "wind";

function forecastIcon(code: number) {
  if (code >= 95) return CloudLightning;
  if (code >= 51 && code <= 82) return CloudRain;
  if (code === 0) return Sun;
  return CloudSun;
}

function parseLocalTime(value: string) {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}:00+07:00`);
}

function formatHour(value: string, index: number) {
  if (index === 0) return "Now";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(parseLocalTime(value));
}

function formatSelectedTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(parseLocalTime(value));
}

function rainAmount(reading: WeatherReading) {
  return reading.rainMm + reading.showersMm;
}

function layerValue(layer: WeatherLayer, reading: WeatherReading) {
  if (layer === "temperature") return `${Math.round(reading.temperatureC)}°`;
  if (layer === "wind") return `${Math.round(reading.windKmh)} km/h`;
  return `${Math.round(reading.precipitationProbability)}%`;
}

function runAdvice(reading: WeatherReading) {
  const amount = rainAmount(reading);
  if (reading.precipitationProbability >= 65 || amount >= 1) return "Rain likely around this time";
  if (reading.windKmh >= 30) return "Windy conditions — take care";
  if (reading.precipitationProbability >= 35) return "Keep an eye on the sky";
  return "Good time to run";
}

const WeatherMap = dynamic(() => import("./weather-map").then((module) => module.WeatherMap), {
  ssr: false,
  loading: () => <div className="route-map h-[280px] animate-pulse rounded-[22px] bg-[#eef1e8] sm:h-[500px]" />,
});

/** Detailed forecast explorer: a forecast grid, map layers, and a time slider for the next 12 hours. */
export function RainForecast() {
  const [forecast, setForecast] = useState<WeatherExplorerForecast>();
  const [selectedLocation, setSelectedLocation] = useState("Bangsaen");
  const [selectedHour, setSelectedHour] = useState(0);
  const [layer, setLayer] = useState<WeatherLayer>("rain");
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadForecast = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(false);
    try {
      const nextForecast = await fetchWeatherExplorerForecast(signal);
      setForecast(nextForecast);
      setSelectedLocation(nextForecast.points[0]?.name ?? "Bangsaen");
      setSelectedHour(0);
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

  useEffect(() => {
    if (!playing || !forecast) return;
    const timer = window.setInterval(() => {
      setSelectedHour((current) => {
        if (current >= forecast.hours.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 1100);
    return () => window.clearInterval(timer);
  }, [forecast, playing]);

  const selectedPoint = useMemo(() => forecast?.points.find((point) => point.name === selectedLocation) ?? forecast?.points[0], [forecast, selectedLocation]);
  const selectedReading = selectedPoint?.readings[selectedHour] ?? selectedPoint?.readings[0];
  const forecastItems = useMemo(() => selectedPoint?.readings ?? [], [selectedPoint]);

  const bestWindow = useMemo(() => {
    if (!forecastItems.length) return "—";
    const best = forecastItems.slice(0, 6).reduce((current, item) => {
      const score = item.precipitationProbability + rainAmount(item) * 20;
      const currentScore = current.precipitationProbability + rainAmount(current) * 20;
      return score < currentScore ? item : current;
    }, forecastItems[0]);
    const bestIndex = forecastItems.indexOf(best);
    return formatHour(best.time, bestIndex);
  }, [forecastItems]);

  return (
    <GlassCard className="overflow-hidden p-0">
      <div className="p-5 pb-4 sm:p-6 sm:pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#dce4d7] text-[#53644e]"><Umbrella size={20} /></div><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#85887f]">Rain outlook</p><h2 className="mt-1 text-xl font-medium tracking-[-.025em]">Weather Explorer</h2><p className="mt-1 text-sm text-[#777b73]">Chonburi coast · 4-area forecast for the next 12 hours</p></div></div>
          <button type="button" onClick={() => void loadForecast()} disabled={loading} className="tap inline-flex items-center gap-2 rounded-2xl border border-[#343b34]/10 bg-white/55 px-3 py-2 text-xs font-semibold text-[#687066] disabled:cursor-wait disabled:opacity-50"><RefreshCw size={14} className={cn(loading && "animate-spin")} />Refresh</button>
        </div>
      </div>

      {loading && !forecast ? <div className="mx-5 mb-5 h-[280px] animate-pulse rounded-[22px] bg-[#eef1e8] sm:mx-6 sm:h-[500px]" /> : error || !forecast ? <div className="mx-5 mb-5 flex min-h-32 items-center justify-between gap-3 rounded-2xl border border-[#a75b55]/15 bg-[#ead9d7]/45 px-4 py-3 text-sm text-[#92514d] sm:mx-6"><span>Weather Explorer is temporarily unavailable.</span><button type="button" onClick={() => void loadForecast()} className="tap rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold">Try again</button></div> : <>
        <div className="scrollbar-none mx-5 mb-3 flex gap-2 overflow-x-auto pb-1 sm:mx-6">{forecast.points.map((point) => <button key={point.name} type="button" onClick={() => { setPlaying(false); setSelectedLocation(point.name); }} className={cn("tap shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition", selectedLocation === point.name ? "border-[#7f9277] bg-[#dce4d7]/80 text-[#53644e]" : "border-[#343b34]/8 bg-white/38 text-[#777b73] hover:bg-white/65")}>{point.name}</button>)}</div>
        <div className="relative mx-5 sm:mx-6">
          <WeatherMap forecast={forecast} selectedHour={selectedHour} layer={layer} selectedLocationName={selectedLocation} />
          <div className="absolute right-3 top-3 z-[500] flex rounded-2xl border border-white/70 bg-[#faf8f2]/88 p-1 shadow-sm backdrop-blur-sm"><button type="button" title="Rain layer" aria-label="Rain layer" onClick={() => setLayer("rain")} className={cn("tap grid size-10 place-items-center rounded-xl text-[#687066]", layer === "rain" && "bg-[#343b34] text-white")}><CloudRain size={17} /></button><button type="button" title="Temperature layer" aria-label="Temperature layer" onClick={() => setLayer("temperature")} className={cn("tap grid size-10 place-items-center rounded-xl text-[#687066]", layer === "temperature" && "bg-[#343b34] text-white")}><Thermometer size={17} /></button><button type="button" title="Wind layer" aria-label="Wind layer" onClick={() => setLayer("wind")} className={cn("tap grid size-10 place-items-center rounded-xl text-[#687066]", layer === "wind" && "bg-[#343b34] text-white")}><Wind size={17} /></button></div>
        </div>

        <div className="p-5 pt-4 sm:p-6 sm:pt-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#85887f]">{selectedReading ? runAdvice(selectedReading) : "Forecast ready"}</p><div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1"><h3 className="text-2xl font-medium tracking-[-.04em]">{selectedReading ? layerValue(layer, selectedReading) : "—"}</h3><span className="text-sm text-[#777b73]">{forecast.hours[selectedHour] ? formatSelectedTime(forecast.hours[selectedHour]) : ""}</span></div></div><div className="rounded-2xl border border-[#343b34]/8 bg-white/42 px-3 py-2 text-xs text-[#687066]"><span className="font-semibold">Best window</span><span className="ml-2">{bestWindow}</span></div></div>
          <div className="mt-5 rounded-2xl border border-[#343b34]/8 bg-white/38 p-3 sm:p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs font-semibold text-[#586254]"><button type="button" onClick={() => setPlaying((current) => !current)} className="tap grid size-10 place-items-center rounded-xl bg-[#343b34] text-white" aria-label={playing ? "Pause forecast animation" : "Play forecast animation"} title={playing ? "Pause forecast animation" : "Play forecast animation"}>{playing ? <Pause size={15} /> : <Play size={15} />}</button><span>{formatHour(forecast.hours[selectedHour] ?? forecast.hours[0], selectedHour)}</span></div><span className="text-[11px] text-[#858880]">{selectedHour + 1} / {forecast.hours.length} hours</span></div><input aria-label="Forecast time" type="range" min="0" max={Math.max(forecast.hours.length - 1, 0)} value={selectedHour} onChange={(event) => { setPlaying(false); setSelectedHour(Number(event.target.value)); }} className="weather-timeline mt-3 w-full" /><div className="mt-2 flex justify-between text-[10px] text-[#92968d]"><span>Now</span><span>+6h</span><span>+12h</span></div></div>
          <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-1">{forecastItems.map((item, index) => { const Icon = forecastIcon(item.weatherCode); const amount = rainAmount(item); return <button key={item.time} type="button" onClick={() => { setPlaying(false); setSelectedHour(index); }} className={cn("min-w-[88px] rounded-2xl border p-3 text-left transition", selectedHour === index ? "border-[#7f9277] bg-[#dce4d7]/70 shadow-sm" : "border-[#343b34]/8 bg-white/38 hover:bg-white/65")}><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-[#586254]">{formatHour(item.time, index)}</span><Icon size={15} className="text-[#7f9277]" /></div><div className="mt-2 text-lg font-semibold text-[#30342f]">{Math.round(item.precipitationProbability)}%</div><div className="mt-1 text-[10px] text-[#858880]">{amount.toFixed(1)} mm · {Math.round(item.temperatureC)}°</div></button>; })}</div>
          {selectedReading && <div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-2xl bg-[#eef1e8]/70 p-3"><span className="block text-[10px] uppercase tracking-[.12em] text-[#858880]">Rain amount</span><strong className="mt-1 block text-sm text-[#586254]">{rainAmount(selectedReading).toFixed(1)} mm/h</strong></div><div className="rounded-2xl bg-[#eef1e8]/70 p-3"><span className="block text-[10px] uppercase tracking-[.12em] text-[#858880]">Temperature</span><strong className="mt-1 block text-sm text-[#586254]">{Math.round(selectedReading.temperatureC)}°C</strong></div><div className="rounded-2xl bg-[#eef1e8]/70 p-3"><span className="block text-[10px] uppercase tracking-[.12em] text-[#858880]">Wind</span><strong className="mt-1 block text-sm text-[#586254]">{Math.round(selectedReading.windKmh)} km/h</strong></div></div>}
          <p className="mt-4 text-[11px] text-[#92968d]">Forecast model for the Chonburi coast from Open-Meteo. Map colors show the selected hour; tap an area, layer, or time to explore.</p>
        </div>
      </>}
    </GlassCard>
  );
}
