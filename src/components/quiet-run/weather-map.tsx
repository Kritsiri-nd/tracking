"use client";

import { MapPin, Radio } from "lucide-react";
import { Fragment } from "react";
import { useEffect, useState } from "react";
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { fetchRainViewerRadar, type RainViewerRadar, type WeatherExplorerForecast, type WeatherReading } from "@/lib/weather";

type WeatherLayer = "rain" | "temperature" | "wind";

function parseLocalTime(value: string) {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}:00+07:00`);
}

function formatSelectedTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(parseLocalTime(value));
}

function rainAmount(reading: WeatherReading) {
  return reading.rainMm + reading.showersMm;
}

function rainColor(reading: WeatherReading) {
  const amount = rainAmount(reading);
  if (amount >= 4 || reading.precipitationProbability >= 90) return "#a855f7";
  if (amount >= 2 || reading.precipitationProbability >= 70) return "#f15b78";
  if (amount >= 0.5 || reading.precipitationProbability >= 40) return "#f5a623";
  if (amount > 0 || reading.precipitationProbability >= 15) return "#77c77d";
  return "#94a394";
}

function temperatureColor(value: number) {
  if (value >= 34) return "#ed5d62";
  if (value >= 31) return "#f4a340";
  if (value >= 28) return "#f0cf67";
  return "#70b7d9";
}

function windColor(value: number) {
  if (value >= 30) return "#a855f7";
  if (value >= 20) return "#f5a623";
  if (value >= 10) return "#70b7d9";
  return "#94a394";
}

function layerColor(layer: WeatherLayer, reading: WeatherReading) {
  if (layer === "temperature") return temperatureColor(reading.temperatureC);
  if (layer === "wind") return windColor(reading.windKmh);
  return rainColor(reading);
}

function layerName(layer: WeatherLayer) {
  if (layer === "temperature") return "Temperature";
  if (layer === "wind") return "Wind";
  return "Rain";
}

function MapLegend({ layer }: { layer: WeatherLayer }) {
  const items = layer === "rain"
    ? [["#2c9bd6", "Light"], ["#087bc1", "Moderate"], ["#ffe500", "Heavy"], ["#f36b21", "Storm"]]
    : layer === "temperature"
      ? [["#70b7d9", "Cool"], ["#f0cf67", "Warm"], ["#f4a340", "Hot"], ["#ed5d62", "Very hot"]]
      : [["#94a394", "Calm"], ["#70b7d9", "Breezy"], ["#f5a623", "Windy"], ["#a855f7", "Strong"]];
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#687066]">{items.map(([color, label]) => <span key={label} className="inline-flex items-center gap-1"><i className="size-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}</div>;
}

export function WeatherMap({ forecast, selectedHour, layer, selectedLocationName }: { forecast: WeatherExplorerForecast; selectedHour: number; layer: WeatherLayer; selectedLocationName: string }) {
  const [radar, setRadar] = useState<RainViewerRadar>();

  useEffect(() => {
    let active = true;
    const loadRadar = () => {
      const controller = new AbortController();
      void fetchRainViewerRadar(controller.signal).then((nextRadar) => {
        if (active) setRadar(nextRadar);
      }).catch(() => undefined);
      return controller;
    };
    let controller = loadRadar();
    const timer = window.setInterval(() => {
      controller.abort();
      controller = loadRadar();
    }, 5 * 60 * 1000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  const latestRadar = radar?.frames.at(-1);
  const radarTime = latestRadar ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(latestRadar.time * 1000)) : undefined;

  return (
    <div className="route-map relative h-[280px] overflow-hidden rounded-[22px] border border-white/60 bg-[#e8e6dc] shadow-inner sm:h-[500px]">
      <MapContainer center={[forecast.latitude, forecast.longitude]} zoom={10} className="h-full w-full" scrollWheelZoom doubleClickZoom>
        <TileLayer className="weather-base-tile" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        {layer === "rain" && selectedHour === 0 && radar && latestRadar && <TileLayer key={latestRadar.path} attribution='<a href="https://www.rainviewer.com/">RainViewer</a>' url={`${radar.host}${latestRadar.path}/256/{z}/{x}/{y}/2/1_1.png`} opacity={0.76} maxNativeZoom={7} maxZoom={19} tileSize={256} zIndex={300} />}
        {forecast.points.map((point) => {
          const reading = point.readings[selectedHour] ?? point.readings[0];
          if (!reading) return null;
          const opacity = layer === "rain" ? Math.min(.72, .16 + reading.precipitationProbability / 150 + rainAmount(reading) / 12) : .28;
          const center: LatLngExpression = [point.latitude, point.longitude];
          const selected = point.name === selectedLocationName;
          return <Fragment key={`${point.latitude}-${point.longitude}`}>{(layer !== "rain" || selectedHour > 0) && <Circle center={center} radius={8500} pathOptions={{ color: layerColor(layer, reading), weight: 1, opacity: .4, fillColor: layerColor(layer, reading), fillOpacity: opacity }} />}<CircleMarker center={center} radius={selected ? 8 : 5} pathOptions={{ color: "#ffffff", weight: selected ? 3 : 2, fillColor: selected ? "#a6ff00" : "#343b34", fillOpacity: 1 }}><Tooltip direction="top" offset={[0, -7]} permanent>{point.name}</Tooltip></CircleMarker></Fragment>;
        })}
      </MapContainer>
      <div className="pointer-events-none absolute left-3 top-3 z-[400] flex items-center gap-2 rounded-full border border-white/20 bg-[#101615]/82 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.14em] text-white shadow-sm backdrop-blur-sm"><MapPin size={13} />{forecast.locationName} · {layer === "rain" && latestRadar && selectedHour === 0 ? "Live radar" : "Forecast"}</div>
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[400] flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/20 bg-[#101615]/82 px-3 py-2 shadow-sm backdrop-blur-sm"><MapLegend layer={layer} /><span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-white">{layer === "rain" && latestRadar && selectedHour === 0 ? <><Radio size={12} />Radar {radarTime ?? "latest"} · RainViewer</> : <>{layerName(layer)} forecast · {formatSelectedTime(forecast.hours[selectedHour] ?? forecast.hours[0])}</>}</span></div>
    </div>
  );
}
