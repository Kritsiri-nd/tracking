"use client";

import { MapPinned } from "lucide-react";
import dynamic from "next/dynamic";
import type { Activity } from "@/lib/types";
import { getActivityTrack } from "@/lib/gpx";
import { GlassCard } from "./shared";

const RealRouteMap = dynamic(() => import("./real-route-map").then((module) => module.RealRouteMap), {
  ssr: false,
  loading: () => <div className="mt-4 grid h-60 place-items-center rounded-[22px] border border-white/60 bg-[#e8e6dc] text-xs text-[#777b73]">Loading real map…</div>,
});

/** Render the real GPS track from an imported FIT activity. */
export function RoutePreview({ activity }: { activity: Activity }) {
  const points = getActivityTrack(activity);
  if (points.length < 2) {
    return <GlassCard className="relative min-h-64 overflow-hidden p-5"><div className="absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(rgba(127,146,119,.13) 1px, transparent 1px), linear-gradient(90deg, rgba(127,146,119,.13) 1px, transparent 1px)", backgroundSize: "28px 28px" }} /><div className="relative flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#85887f]">GPS route</p><h2 className="mt-1 text-lg font-medium">No GPS track in this activity</h2><p className="mt-2 max-w-sm text-sm leading-6 text-[#858880]">Import a FIT file that contains location records to see the real route and export it as GPX.</p></div><MapPinned className="text-[#9b9e96]" /></div></GlassCard>;
  }
  return <GlassCard className="relative overflow-hidden p-5"><div className="relative flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#85887f]">GPS route</p><h2 className="mt-1 text-lg font-medium">Route from FIT</h2><p className="mt-1 text-xs text-[#858880]">{points.length} GPS points · real map background</p></div><MapPinned className="text-[#7f9277]" /></div><RealRouteMap points={points} /></GlassCard>;
}

