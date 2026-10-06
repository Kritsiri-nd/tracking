"use client";

import { CloudRain, LocateFixed, RefreshCw, Thermometer, Umbrella, Wind } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { CHONBURI_LOCATIONS, fetchWeatherExplorerForecast, parseLocalTime, type WeatherExplorerForecast, type WeatherLocation } from "@/lib/weather";
import { findBestRunWindow, rainAmount, runAdvice, type WeatherLayer, type WeatherMode } from "@/lib/weather-planning";
import { GlassCard, cn } from "./shared";

const WeatherMap = dynamic(() => import("./weather-map").then((module) => module.WeatherMap), { ssr: false, loading: () => <div className="h-80 animate-pulse rounded-[22px] bg-[#eef1e8]" /> });
const preferenceKey = "stridebook-weather-v1";
const buttonStyle = "tap rounded-xl border border-[#343b34]/10 bg-white/45 px-3 py-2 text-xs font-semibold text-[#687066] disabled:opacity-50";
const timeLabel = (time: number) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(time));
const dateTimeLabel = (time: number) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(time));

function validLocation(value: unknown): value is WeatherLocation {
  if (!value || typeof value !== "object") return false;
  const point = value as WeatherLocation;
  return typeof point.name === "string" && point.name.length > 0 && point.name.length <= 60 && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180;
}

export function RainForecast() {
  const [forecast, setForecast] = useState<WeatherExplorerForecast>();
  const [location, setLocation] = useState<WeatherLocation>(CHONBURI_LOCATIONS[0]);
  const [customLocation, setCustomLocation] = useState<WeatherLocation>();
  const [selectedHour, setSelectedHour] = useState(0);
  const [mode, setMode] = useState<WeatherMode>("radar");
  const [layer, setLayer] = useState<WeatherLayer>("rain");
  const [duration, setDuration] = useState(60);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string>();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(preferenceKey) ?? "null");
        if (saved && validLocation(saved.location)) {
          setLocation(saved.location);
          if (!CHONBURI_LOCATIONS.some((point) => point.name === saved.location.name && point.latitude === saved.location.latitude && point.longitude === saved.location.longitude)) setCustomLocation(saved.location);
        }
        if (saved && [30, 60, 90].includes(saved.duration)) setDuration(saved.duration);
      } catch { /* Unavailable storage does not prevent checking weather. */ }
      setInitialized(true);
    });
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => { window.cancelAnimationFrame(frame); window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!initialized) return;
    try { window.localStorage.setItem(preferenceKey, JSON.stringify({ location, duration })); } catch { /* Keep preferences in memory. */ }
  }, [initialized, location, duration]);

  useEffect(() => {
    if (!initialized) return;
    let controller: AbortController;
    let active = true;
    const load = () => {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      setLoading(true); setError(false);
      void fetchWeatherExplorerForecast(signal, customLocation).then((next) => {
        if (!active || signal.aborted) return;
        setForecast(next);
        setNow(Date.now());
        setSelectedHour((current) => Math.min(current, next.hours.length - 1));
      }).catch(() => { if (active && !signal.aborted) setError(true); })
        .finally(() => { if (active && !signal.aborted) setLoading(false); });
    };
    const initial = window.setTimeout(load, 0);
    const timer = window.setInterval(load, 10 * 60_000);
    return () => { active = false; controller?.abort(); window.clearTimeout(initial); window.clearInterval(timer); };
  }, [initialized, customLocation, revision]);

  const selectedPoint = forecast?.points.find((point) => point.name === location.name && point.latitude === location.latitude && point.longitude === location.longitude);
  const readings = selectedPoint?.readings;
  const selectedReading = readings?.[selectedHour];
  const ageMinutes = forecast ? Math.max(0, Math.floor((now - forecast.fetchedAt) / 60_000)) : undefined;
  const stale = ageMinutes !== undefined && ageMinutes > 30;
  const bestWindow = readings && !stale ? findBestRunWindow(readings, duration, now) : undefined;
  const locations = customLocation ? [...CHONBURI_LOCATIONS, customLocation] : CHONBURI_LOCATIONS;

  function selectLocation(name: string) {
    const next = locations.find((point) => point.name === name);
    if (next) { setLocation(next); setLocationError(undefined); }
  }
  function pinLocation(next: WeatherLocation) {
    if (!validLocation(next)) return;
    setCustomLocation(next); setLocation(next); setSelectedHour(0); setLocationError(undefined);
  }
  function locate() {
    if (!navigator.geolocation) { setLocationError("Your browser does not support location. Tap the map to choose a place."); return; }
    setLocating(true); setLocationError(undefined);
    navigator.geolocation.getCurrentPosition((position) => {
      pinLocation({ name: "My running spot", latitude: position.coords.latitude, longitude: position.coords.longitude });
      setLocating(false);
    }, (failure) => {
      setLocationError(failure.code === 1 ? "Location access was declined. You can tap the map to choose your running spot." : "Could not get your location. Try again or tap the map.");
      setLocating(false);
    }, { timeout: 10_000, maximumAge: 60_000, enableHighAccuracy: false });
  }

  return <GlassCard className="weather-explorer overflow-hidden p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#dce4d7] text-[#53644e]"><Umbrella size={20} /></div><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#85887f]">Plan your run</p><h2 className="mt-1 text-xl font-medium">Weather Explorer</h2><p className="mt-1 text-sm text-[#777b73]">Check rain nearby, then compare times to head out.</p></div></div></div>
    <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Weather map mode">{([{ id: "radar", label: "Radar · past 2 hours" }, { id: "forecast", label: "Forecast · next 12 hours" }] as const).map((item) => <button type="button" key={item.id} aria-pressed={mode === item.id} onClick={() => setMode(item.id)} className={cn(buttonStyle, mode === item.id && "weather-choice-active")}>{item.label}</button>)}</div>
    <div className="mt-4 flex flex-wrap items-center gap-2">{locations.map((point) => <button type="button" key={point.name} aria-pressed={location.name === point.name} onClick={() => selectLocation(point.name)} className={cn(buttonStyle, location.name === point.name && "weather-choice-active")}>{point.name}</button>)}<button type="button" onClick={locate} disabled={locating} className={cn(buttonStyle, "inline-flex items-center gap-1.5")}><LocateFixed size={14} />{locating ? "Locating…" : "Use my location"}</button></div>
    <p className="mb-3 mt-2 text-[11px] text-[#777b73]">{location.name} · {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)} · Tap an area marker to select it, or tap the map to pin a running spot. Your choice is remembered on this device.</p>
    {locationError && <p role="alert" className="mb-3 rounded-xl bg-[#ead9d7]/60 p-3 text-xs text-[#92514d]">{locationError}</p>}
    {mode === "forecast" && <div role="group" aria-label="Forecast map layer" className="mb-3 flex flex-wrap gap-2">{([{ id: "rain", label: "Rain chance", icon: CloudRain }, { id: "temperature", label: "Temperature", icon: Thermometer }, { id: "wind", label: "Wind", icon: Wind }] as const).map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-pressed={layer === id} onClick={() => setLayer(id)} className={cn(buttonStyle, "inline-flex items-center gap-1.5", layer === id && "weather-choice-active")}><Icon size={14} />{label}</button>)}</div>}
    <WeatherMap forecast={forecast} selectedHour={selectedHour} layer={layer} mode={mode} selectedLocation={location} onSelectLocation={selectLocation} onPin={pinLocation} />
    {mode === "forecast" && <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-[#777b73]">Open-Meteo · {forecast ? `Retrieved ${ageMinutes} min ago` : "Hourly forecast"}{loading ? " · Updating…" : ""}</p><button type="button" disabled={loading} onClick={() => setRevision((current) => current + 1)} className={cn(buttonStyle, "inline-flex items-center gap-1.5")}><RefreshCw size={13} className={cn(loading && "animate-spin")} />Refresh forecast</button></div>
      {error && <p role="alert" className="rounded-xl bg-[#ead9d7]/60 p-3 text-xs text-[#92514d]">Forecast could not be updated.{selectedPoint ? " Showing the last retrieved forecast." : " Try Refresh forecast."}</p>}
      {stale && <p role="status" className="rounded-xl bg-[#ead9d7]/60 p-3 text-xs text-[#92514d]">This forecast was retrieved over 30 minutes ago. Refresh before comparing run times.</p>}
      {!selectedPoint ? <p role="status" className="rounded-2xl bg-white/40 p-4 text-sm text-[#777b73]">{loading ? "Loading forecast for this running spot…" : "No forecast available for this spot."}</p> : <>
        <div className="rounded-2xl border border-[#343b34]/10 bg-white/40 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm">Compare run times</b><div role="group" aria-label="Run duration" className="flex gap-1">{[30, 60, 90].map((minutes) => <button type="button" key={minutes} aria-pressed={duration === minutes} onClick={() => setDuration(minutes)} className={cn(buttonStyle, duration === minutes && "weather-choice-active")}>{minutes} min</button>)}</div></div>
          {bestWindow ? <><p className="mt-3 text-lg font-semibold">{dateTimeLabel(bestWindow.start)} – {timeLabel(bestWindow.end)}</p><p className="mt-1 text-xs text-[#687066]">Lowest combined rain, heat and wind score in the next 6 hours · {duration}-minute run</p><p className="mt-2 text-xs text-[#777b73]">Up to {Math.round(bestWindow.maxRainProbability)}% rain chance · {Math.round(bestWindow.maxTemperatureC)}°C · {Math.round(bestWindow.maxWindKmh)} km/h wind</p><button type="button" onClick={() => { const index = readings!.findIndex((reading) => parseLocalTime(reading.time).getTime() > bestWindow.start); if (index >= 0) setSelectedHour(index); }} className={cn(buttonStyle, "mt-3")}>View this hour</button></> : <p className="mt-3 text-sm text-[#777b73]">{stale ? "Refresh to compare times." : "No suitable forecast window for the full run. Check the hours below or consider an indoor session."}</p>}
          <p className="mt-3 text-[11px] leading-5 text-[#777b73]">Compares hourly forecasts across your whole run. Excludes forecast thunderstorms, temperatures ≥35°C and winds ≥40 km/h. This is a comparison, not a guarantee of dry or safe conditions.</p>
        </div>
        {selectedReading && <><div><p className="text-sm font-semibold">{runAdvice(selectedReading)}</p><p className="mt-1 text-xs text-[#777b73]">Hour ending {dateTimeLabel(parseLocalTime(selectedReading.time).getTime())}</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Rain chance", `${Math.round(selectedReading.precipitationProbability)}%`], ["Rain total / hour", `${rainAmount(selectedReading).toFixed(1)} mm`], ["Temperature", `${Math.round(selectedReading.temperatureC)}°C`], ["Wind", `${Math.round(selectedReading.windKmh)} km/h`]].map(([label, value]) => <div key={label} className="rounded-2xl bg-white/40 p-3"><span className="block text-[10px] text-[#858880]">{label}</span><b className="mt-1 block text-sm">{value}</b></div>)}</div></>}
        <label className="block text-xs font-semibold text-[#687066]">Forecast hour<input type="range" min="0" max={Math.max((readings?.length ?? 1) - 1, 0)} value={selectedHour} aria-label="Forecast time" aria-valuetext={selectedReading ? dateTimeLabel(parseLocalTime(selectedReading.time).getTime()) : ""} onChange={(event) => setSelectedHour(Number(event.target.value))} className="weather-timeline mt-3 w-full" /></label>
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-2">{readings?.map((reading, index) => <button type="button" key={reading.time} aria-pressed={selectedHour === index} onClick={() => setSelectedHour(index)} className={cn("min-w-[100px] shrink-0 rounded-2xl border p-3 text-left", selectedHour === index ? "border-[#7f9277] bg-[#dce4d7]/70" : "border-[#343b34]/10 bg-white/40")}><span className="block text-xs font-semibold">{dateTimeLabel(parseLocalTime(reading.time).getTime())}</span><b className="mt-2 block text-lg">{Math.round(reading.precipitationProbability)}%</b><span className="mt-1 block text-[10px] text-[#777b73]">{rainAmount(reading).toFixed(1)} mm · {Math.round(reading.temperatureC)}°C</span></button>)}</div>
        <p className="text-[11px] leading-5 text-[#777b73]">Rain amounts and probabilities describe the hour ending at each shown time. Temperature and wind are hourly model values. A point forecast does not show the exact shape or arrival time of a rain cloud.</p>
      </>}
    </div>}
  </GlassCard>;
}
