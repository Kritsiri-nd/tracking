"use client";

import { Pause, Play, RefreshCw } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { CHONBURI_LOCATIONS, fetchRainViewerRadar, type RainViewerRadar, type WeatherExplorerForecast, type WeatherLocation, type WeatherReading } from "@/lib/weather";
import { forecastColor, forecastScales, type WeatherLayer, type WeatherMode } from "@/lib/weather-planning";
import { cn } from "./shared";

const timeLabel = (time: number) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(time));

function MapInteraction({ location, onPin }: { location: WeatherLocation; onPin: (location: WeatherLocation) => void }) {
  const map = useMap();
  useEffect(() => { map.setView([location.latitude, location.longitude], map.getZoom()); }, [location.latitude, location.longitude, map]);
  useMapEvents({ click: (event) => onPin({ name: "Pinned location", latitude: event.latlng.lat, longitude: event.latlng.lng }) });
  return null;
}

type Props = { forecast?: WeatherExplorerForecast; selectedHour: number; layer: WeatherLayer; mode: WeatherMode; selectedLocation: WeatherLocation; onSelectLocation: (name: string) => void; onPin: (location: WeatherLocation) => void };

export function WeatherMap({ forecast, selectedHour, layer, mode, selectedLocation, onSelectLocation, onPin }: Props) {
  const [radar, setRadar] = useState<RainViewerRadar>();
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [failedFrame, setFailedFrame] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [showCoverage, setShowCoverage] = useState(true);
  const [coverageError, setCoverageError] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (mode !== "radar") return;
    let controller: AbortController;
    let active = true;
    const load = () => {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      setLoading(true); setError(false); setPlaying(false); setFailedFrame(undefined); setCoverageError(false);
      void fetchRainViewerRadar(signal).then((next) => {
        if (!active || signal.aborted) return;
        setRadar(next); setFrameIndex(next.pastFrames.length - 1);
      }).catch(() => { if (active && !signal.aborted) setError(true); })
        .finally(() => { if (active && !signal.aborted) setLoading(false); });
    };
    const initial = window.setTimeout(load, 0);
    const timer = window.setInterval(load, 5 * 60_000);
    return () => { active = false; controller?.abort(); window.clearTimeout(initial); window.clearInterval(timer); };
  }, [mode, revision]);

  const frames = radar?.pastFrames ?? [];
  const frame = frames[frameIndex] ?? frames.at(-1);
  const latest = frames.at(-1);
  const latestAge = latest ? Math.max(0, Math.floor((now - latest.time * 1000) / 60_000)) : undefined;
  const frameAge = frame ? Math.max(0, Math.floor((now - frame.time * 1000) / 60_000)) : undefined;
  useEffect(() => {
    if (!playing || mode !== "radar" || frames.length < 2) return;
    const timer = window.setInterval(() => setFrameIndex((current) => (current + 1) % frames.length), 900);
    return () => window.clearInterval(timer);
  }, [playing, mode, frames.length]);

  const points: Array<WeatherLocation & { readings?: WeatherReading[] }> = (forecast?.points ?? CHONBURI_LOCATIONS).filter((point) => point.name !== selectedLocation.name || (point.latitude === selectedLocation.latitude && point.longitude === selectedLocation.longitude));
  return <div className="space-y-3">
    <div className="route-map relative h-[320px] overflow-hidden rounded-[22px] border border-white/60 bg-[#e8e6dc] sm:h-[460px]">
      <MapContainer center={[selectedLocation.latitude, selectedLocation.longitude]} zoom={10} className="h-full w-full" scrollWheelZoom={false}>
        <MapInteraction location={selectedLocation} onPin={onPin} />
        <TileLayer className="weather-base-tile" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        {mode === "radar" && radar && frame && <TileLayer key={`${frame.path}-${revision}`} attribution='<a href="https://www.rainviewer.com/">RainViewer</a>' url={`${radar.host}${frame.path}/256/{z}/{x}/{y}/2/1_0.png`} opacity={0.76} maxNativeZoom={7} maxZoom={19} zIndex={300} eventHandlers={{ tileerror: () => setFailedFrame(frame.path) }} />}
        {mode === "radar" && radar && showCoverage && <TileLayer key={`coverage-${revision}`} url={`${radar.host}/v2/coverage/0/256/{z}/{x}/{y}/0/0_0.png`} opacity={0.35} maxNativeZoom={7} maxZoom={19} zIndex={310} eventHandlers={{ tileerror: () => setCoverageError(true) }} />}
        {points.map((point) => {
          const reading = point.readings?.[selectedHour];
          const selected = point.name === selectedLocation.name;
          return <Fragment key={`${point.name}-${point.latitude}-${point.longitude}`}>
            {mode === "forecast" && reading && <Circle center={[point.latitude, point.longitude]} radius={6500} pathOptions={{ color: forecastColor(layer, reading), weight: 1, fillColor: forecastColor(layer, reading), fillOpacity: .3 }} bubblingMouseEvents={false} eventHandlers={{ click: () => onSelectLocation(point.name) }} />}
            <CircleMarker center={[point.latitude, point.longitude]} radius={selected ? 9 : 6} pathOptions={{ color: "#fff", weight: 2, fillColor: selected ? "#a6ff00" : "#343b34", fillOpacity: 1 }} bubblingMouseEvents={false} eventHandlers={{ click: () => onSelectLocation(point.name) }}><Tooltip direction="top" permanent>{point.name}</Tooltip></CircleMarker>
          </Fragment>;
        })}
        {!points.some((point) => point.name === selectedLocation.name && point.latitude === selectedLocation.latitude && point.longitude === selectedLocation.longitude) && <CircleMarker center={[selectedLocation.latitude, selectedLocation.longitude]} radius={9} pathOptions={{ color: "#fff", fillColor: "#a6ff00", fillOpacity: 1 }}><Tooltip permanent>{selectedLocation.name}</Tooltip></CircleMarker>}
      </MapContainer>
    </div>
    {mode === "radar" ? <div className="rounded-2xl border border-[#343b34]/10 bg-white/40 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="text-xs text-[#687066]"><b>Observed radar</b>{frame && <span> · Frame {timeLabel(frame.time * 1000)} · {frameAge} min ago</span>}</div><button type="button" disabled={loading} onClick={() => setRevision((current) => current + 1)} className="tap inline-flex items-center gap-1.5 rounded-xl bg-white/60 px-3 py-2 text-xs font-semibold disabled:opacity-50"><RefreshCw size={13} className={cn(loading && "animate-spin")} />{loading ? "Updating…" : "Refresh radar"}</button></div>
      {error && <p role="alert" className="mt-2 rounded-xl bg-[#ead9d7]/70 p-3 text-xs text-[#92514d]">Radar could not be updated.{radar ? " Showing the last loaded frames." : " A blank map does not mean there is no rain. Try Refresh radar."}</p>}
      {loading && !radar && <p role="status" className="mt-2 text-xs text-[#777b73]">Loading radar frames…</p>}
      {frame && failedFrame === frame.path && <p role="alert" className="mt-2 text-xs text-[#92514d]">Some radar tiles failed to load. Try refreshing; missing imagery does not mean clear weather.</p>}
      {showCoverage && coverageError && <p role="alert" className="mt-2 text-xs text-[#92514d]">Coverage shading could not fully load. Unshaded areas may also lack radar coverage.</p>}
      {latestAge !== undefined && latestAge > 20 && <p role="status" className="mt-2 text-xs text-[#92514d]">Latest available frame is {latestAge} minutes old. Radar may be delayed.</p>}
      {!!frames.length && <><div className="mt-3 flex items-center gap-2"><button type="button" disabled={frames.length < 2} onClick={() => { if (!playing && frameIndex >= frames.length - 1) setFrameIndex(0); setPlaying((current) => !current); }} aria-label={playing ? "Pause radar animation" : "Play radar animation"} className="tap grid size-10 shrink-0 place-items-center rounded-xl bg-[#343b34] text-white disabled:opacity-40">{playing ? <Pause size={14} /> : <Play size={14} />}</button><input aria-label="Radar history time" aria-valuetext={frame ? timeLabel(frame.time * 1000) : ""} type="range" min="0" max={frames.length - 1} value={frameIndex} onChange={(event) => { setPlaying(false); setFrameIndex(Number(event.target.value)); }} className="weather-timeline min-w-0 flex-1" /><button type="button" onClick={() => { setPlaying(false); setFrameIndex(frames.length - 1); }} className="tap shrink-0 rounded-xl bg-[#dce4d7]/70 px-3 py-2 text-xs font-semibold">Latest</button></div><div className="mt-2 flex justify-between text-[11px] text-[#777b73]"><span>{timeLabel(frames[0].time * 1000)}</span><span>{timeLabel(latest!.time * 1000)}</span></div></>}
      <label className="mt-3 flex items-center gap-2 text-xs text-[#687066]"><input type="checkbox" checked={showCoverage} onChange={(event) => setShowCoverage(event.target.checked)} />Shade areas without radar coverage</label>
      <p className="mt-2 text-[11px] leading-5 text-[#777b73]">Past observations only · auto-refresh every 5 min. Gray shading means no radar coverage. Frame times describe image generation, not an exact local observation time. <a href="https://www.rainviewer.com/api/color-schemes.html" target="_blank" rel="noreferrer" className="underline">RainViewer intensity color scale</a></p>
    </div> : <div className="rounded-2xl border border-[#343b34]/10 bg-white/40 p-3"><div className="flex flex-wrap gap-x-3 gap-y-2 text-[11px] text-[#687066]">{forecastScales[layer].map((item) => <span key={item.label} className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full" style={{ background: item.color }} />{item.label}</span>)}</div><p className="mt-2 text-[11px] text-[#777b73]">{layer === "rain" ? "Colors show hourly rain probability, not radar intensity." : `Colors show forecast ${layer}.`} Circles represent point forecasts; their size does not show a storm&apos;s extent.</p></div>}
  </div>;
}
