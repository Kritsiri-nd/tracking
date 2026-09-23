"use client";

import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import type { ActivityTrackPoint } from "@/lib/types";

function FitTrack({ positions }: { positions: LatLngExpression[] }) {
  const map = useMap();
  const bounds = useMemo<LatLngBoundsExpression>(() => positions as LatLngBoundsExpression, [positions]);

  useEffect(() => {
    if (positions.length > 1) map.fitBounds(bounds, { padding: [52, 52], maxZoom: 16, animate: false });
    map.invalidateSize();
  }, [bounds, map, positions.length]);

  return null;
}

/** Real OpenStreetMap tiles with the FIT GPS track drawn above them. */
export function RealRouteMap({ points }: { points: ActivityTrackPoint[] }) {
  const positions = useMemo<LatLngExpression[]>(() => points.map((point) => [point.latitude, point.longitude]), [points]);
  const start = positions[0] ?? [0, 0];
  const finish = positions[positions.length - 1] ?? start;

  return (
    <div className="route-map relative mt-4 h-[360px] overflow-hidden rounded-[22px] border border-white/60 bg-[#e8e6dc] shadow-inner sm:h-[480px]">
      <MapContainer center={start} zoom={14} className="h-full w-full" scrollWheelZoom={false} doubleClickZoom={false} keyboard={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <FitTrack positions={positions} />
        <Polyline positions={positions} pathOptions={{ color: "#bd755c", weight: 5, opacity: 0.95, lineCap: "round", lineJoin: "round" }} />
        <CircleMarker center={start} radius={7} pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#7f9277", fillOpacity: 1 }} />
        <CircleMarker center={finish} radius={7} pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#343b34", fillOpacity: 1 }} />
      </MapContainer>
      <div className="pointer-events-none absolute left-3 top-3 z-[400] rounded-full border border-white/75 bg-[#faf8f2]/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.14em] text-[#586254] shadow-sm backdrop-blur-sm">Real map · FIT route</div>
      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex items-center gap-3 rounded-full border border-white/70 bg-[#faf8f2]/85 px-3 py-1.5 text-[11px] text-[#687066] shadow-sm backdrop-blur-sm"><span><i className="mr-1.5 inline-block size-2 rounded-full bg-[#7f9277]" />Start</span><span><i className="mr-1.5 inline-block size-2 rounded-full bg-[#343b34]" />Finish</span></div>
    </div>
  );
}
