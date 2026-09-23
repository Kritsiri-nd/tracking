"use client";

import { Activity as ActivityIcon, ArrowLeft, Clock3, Download, Gauge, HeartPulse, Route, Save, Target, Thermometer, TrendingUp, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { BANGKOK_TIME_ZONE_NAME } from "@/lib/date";
import { cleanFitFileName } from "@/lib/fit";
import { getActivityTrack } from "@/lib/gpx";
import { heartRateZones, zoneColors } from "@/lib/hr-zones";
import { formatCadencePerSecond, formatDuration, formatPace, getActivitySplits, getWorkoutStatus, percent } from "@/lib/progress";
import type { Activity, PlannedWorkout, Shoe } from "@/lib/types";
import { GlassCard, Metric, StatusPill, cn, workoutLabels } from "./shared";
import { ActivityCompareChart } from "./activity-compare-chart";
import { RoutePreview } from "./route-preview";

/** Detail page for one FIT run, including route, effort charts, splits, and gear. */
export function ActivityDetail({ activity, workout, shoes, maxHr, onMaxHrChange, onBack, onShoeChange, onActivityUpdate, onExportGpx }: { activity: Activity; workout?: PlannedWorkout; shoes: Shoe[]; maxHr: number; onMaxHrChange: (maxHr: number) => void; onBack: () => void; onShoeChange: (shoeId?: string) => void; onActivityUpdate: (updates: Partial<Pick<Activity, "rpe" | "note">>) => void; onExportGpx: () => void }) {
  const status = workout ? getWorkoutStatus(workout, activity) : "completed";
  const activityShoes = shoes.filter((shoe) => shoe.personId === activity.personId && !shoe.retired);
  const hasTrack = getActivityTrack(activity).length > 1;
  const [zoneMaxHr, setZoneMaxHr] = useState<string>();
  const effectiveZoneMaxHr = zoneMaxHr ?? String(maxHr);
  const [splitMode, setSplitMode] = useState<"1" | "5" | "10" | "manual">("1");
  const [manualSplitKm, setManualSplitKm] = useState("1");
  const selectedSplitKm = splitMode === "manual" ? Number(manualSplitKm) : Number(splitMode);
  const splitDistanceKm = Number.isFinite(selectedSplitKm) && selectedSplitKm > 0 ? selectedSplitKm : 1;
  const splits = useMemo(() => getActivitySplits(activity, splitDistanceKm), [activity, splitDistanceKm]);
  const cumulativeSplits = useMemo(() => splits.reduce<Array<(typeof splits)[number] & { elapsedSec: number }>>((result, split) => {
    const previousElapsedSec = result[result.length - 1]?.elapsedSec ?? 0;
    return [...result, { ...split, elapsedSec: previousElapsedSec + split.durationSec }];
  }, []), [splits]);
  const zones = heartRateZones(activity, Number(effectiveZoneMaxHr) || maxHr);
  const startedAtLabel = new Intl.DateTimeFormat("en", { timeZone: BANGKOK_TIME_ZONE_NAME, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(activity.startedAt));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><button onClick={onBack} className="tap flex items-center gap-2 rounded-full bg-white/45 px-4 py-2 text-sm font-semibold"><ArrowLeft size={17} />Back</button><button type="button" disabled={!hasTrack} onClick={onExportGpx} className="tap inline-flex items-center gap-2 rounded-full bg-[#343b34] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Download size={16} />Export GPX</button></div>
      <div><p className="text-sm text-[#7d8078]">{startedAtLabel}</p><div className="mt-1 flex flex-wrap items-center gap-3"><h1 className="text-[34px] font-medium tracking-[-.055em]">{activity.title}</h1><StatusPill status={status} /></div><p className="mt-1 text-sm text-[#777b73]">Me · {activity.source} · {workoutLabels[activity.type]}</p></div>

      <GlassCard className="p-5"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-8"><Metric label="Distance" value={activity.distanceKm.toFixed(2)} suffix="km" icon={Route} /><Metric label="Time" value={formatDuration(activity.durationSec)} suffix="h" icon={Clock3} /><Metric label="Pace" value={formatPace(activity.paceSecPerKm)} suffix="/km" icon={Gauge} /><Metric label="Avg HR" value={activity.avgHr?.toFixed(0) ?? "—"} suffix="bpm" icon={HeartPulse} /><Metric label="Max HR" value={activity.maxHr?.toFixed(0) ?? "—"} suffix="bpm" icon={HeartPulse} /><Metric label="Elevation" value={activity.elevationGainM?.toFixed(0) ?? "—"} suffix="m" icon={TrendingUp} /><Metric label="Cadence" value={formatCadencePerSecond(activity.avgCadence)} suffix="steps/s" icon={ActivityIcon} /><Metric label="Calories" value={activity.calories?.toFixed(0) ?? "—"} suffix="kcal" icon={Zap} /></div></GlassCard>
      {workout && <GlassCard className="p-5"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-[#dce4d7] text-[#53644e]"><Target size={20} /></div><div className="flex-1"><div className="text-xs font-semibold uppercase tracking-[.16em] text-[#85887f]">Compared with plan</div><div className="mt-1 text-sm font-semibold">{workout.distanceKm} km planned · {percent(activity.distanceKm, workout.distanceKm ?? 0)}% completed</div></div><StatusPill status={status} /></div></GlassCard>}
      <RoutePreview activity={activity} />

      <ActivityCompareChart activity={activity} />

      <GlassCard className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#85887f]">Heart rate zones</p><h2 className="mt-1 text-lg font-medium">Where the effort went</h2><p className="mt-1 text-xs text-[#858880]">Estimated from sampled HR data and your profile max HR.</p></div><label className="text-xs font-medium text-[#72766d]">Max HR<input type="number" min="100" max="240" value={effectiveZoneMaxHr} onChange={(event) => setZoneMaxHr(event.target.value)} onBlur={() => { const value = Math.min(240, Math.max(100, Math.round(Number(effectiveZoneMaxHr) || maxHr))); setZoneMaxHr(String(value)); onMaxHrChange(value); }} className="ml-2 h-10 w-20 rounded-xl border border-[#343b34]/10 bg-white/55 px-2 text-sm outline-none focus:border-[#7f9277]" /> bpm</label></div><div className="mt-5 flex h-4 overflow-hidden rounded-full bg-[#e9e6dc]">{zones.map((zone, index) => <div key={zone.zone} title={`Zone ${zone.zone}: ${zone.percentage}%`} className="h-full" style={{ width: `${zone.percentage}%`, backgroundColor: zoneColors[index] }} />)}</div><div className="mt-5 grid gap-2 sm:grid-cols-5">{zones.map((zone, index) => <div key={zone.zone} className="rounded-2xl border border-white/70 bg-white/42 p-3"><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-sm font-semibold"><i className="size-2.5 rounded-full" style={{ backgroundColor: zoneColors[index] }} />Zone {zone.zone}</span><span className="text-xs font-semibold text-[#777b73]">{zone.percentage}%</span></div><p className="mt-1 text-xs text-[#858880]">{zone.label} · {zone.maxBpm ? `${zone.minBpm}–${zone.maxBpm}` : `${zone.minBpm}+`} bpm</p><p className="mt-2 text-sm font-semibold">{formatDuration(zone.durationSec)} h</p></div>)}</div></GlassCard>

      <GlassCard className="overflow-hidden p-0">
        <div className="border-b border-[#343b34]/8 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#85887f]">Splits</p><h2 className="mt-1 text-lg font-medium">Every {splitDistanceKm % 1 === 0 ? splitDistanceKm : splitDistanceKm.toFixed(1)} km</h2><p className="mt-1 text-xs text-[#858880]">Calculated from the activity stream when FIT laps are incomplete.</p></div>
            <div className="flex flex-wrap gap-1 rounded-2xl bg-white/45 p-1" role="group" aria-label="Split distance">
              {[{ value: "1", label: "1 km" }, { value: "5", label: "5 km" }, { value: "10", label: "10 km" }, { value: "manual", label: "Manual" }].map((option) => <button key={option.value} type="button" onClick={() => setSplitMode(option.value as "1" | "5" | "10" | "manual")} className={cn("tap rounded-xl px-3 py-2 text-xs font-semibold", splitMode === option.value ? "bg-[#343b34] text-white" : "text-[#6d7269]")}>{option.label}</button>)}
            </div>
          </div>
          {splitMode === "manual" && <label className="mt-3 flex items-center gap-2 text-xs font-medium text-[#72766d]">Split distance<input type="number" min="0.1" max={activity.distanceKm} step="0.1" value={manualSplitKm} onChange={(event) => setManualSplitKm(event.target.value)} className="h-9 w-20 rounded-xl border border-[#343b34]/10 bg-white/65 px-2 text-sm outline-none focus:border-[#7f9277]" /> km</label>}
        </div>
        <div className="divide-y divide-[#343b34]/7">{cumulativeSplits.map((lap) => <div key={lap.lap} className="flex items-start gap-3 px-5 py-3 text-sm"><div className="grid size-8 shrink-0 place-items-center rounded-xl bg-white/55 font-semibold">{lap.lap}</div><div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4"><div><span className="text-xs text-[#888b84]">Pace</span><div className="font-semibold">{formatPace(lap.paceSecPerKm)} /km</div></div><div><span className="text-xs text-[#888b84]">Total time</span><div className="font-semibold">{formatDuration(Math.round(lap.elapsedSec))} h</div></div><div><span className="text-xs text-[#888b84]">Avg HR</span><div className="font-semibold">{lap.avgHr ?? "—"} bpm</div></div><div><span className="text-xs text-[#888b84]">Cadence</span><div className="font-semibold">{formatCadencePerSecond(lap.avgCadence)} steps/s</div></div></div></div>)}</div>
      </GlassCard>

      <div className="grid gap-5 lg:grid-cols-2"><GlassCard className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#85887f]">Gear</p><h2 className="mt-1 text-lg font-medium">Shoe used</h2></div><select aria-label="Shoe used" value={activity.shoeId ?? ""} onChange={(event) => onShoeChange(event.target.value || undefined)} className="h-11 min-w-48 rounded-2xl border border-[#343b34]/10 bg-white/55 px-3 text-sm outline-none focus:border-[#7f9277]"><option value="">No shoe selected</option>{activityShoes.map((shoe) => <option key={shoe.id} value={shoe.id}>{shoe.name}</option>)}</select></div><p className="mt-2 text-sm text-[#858880]">{activity.calories ? `${activity.calories} kcal` : "Calories unavailable"} · {activity.importedFileName ? cleanFitFileName(activity.importedFileName) : "Manual activity"}</p></GlassCard><GlassCard className="p-5"><div className="flex items-start gap-3"><Thermometer size={19} className="mt-0.5 text-[#c29a51]" /><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#85887f]">Runner note</p><p className="mt-1 text-sm leading-6 text-[#777b73]">{activity.note || "No note added for this activity."}</p>{activity.rpe && <p className="mt-2 text-xs font-semibold text-[#858880]">RPE {activity.rpe}/10</p>}</div></div></GlassCard></div>
      <ActivityFeedback activity={activity} onSave={onActivityUpdate} />
    </div>
  );
}

function ActivityFeedback({ activity, onSave }: { activity: Activity; onSave: (updates: Partial<Pick<Activity, "rpe" | "note">>) => void }) {
  const [note, setNote] = useState(activity.note ?? "");
  const [rpe, setRpe] = useState(activity.rpe ? String(activity.rpe) : "");

  function save() {
    const value = Number(rpe);
    onSave({ note: note.trim() || undefined, rpe: Number.isFinite(value) && value >= 1 && value <= 10 ? Math.round(value) : undefined });
  }

  return <GlassCard className="p-5"><div className="flex items-start gap-3"><Thermometer size={19} className="mt-0.5 text-[#c29a51]" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#85887f]">Post-run feedback</p><h2 className="mt-1 text-lg font-medium">How did this run feel?</h2></div><label className="text-xs font-medium text-[#72766d]">RPE (1–10)<input aria-label="Rate of perceived exertion" type="number" min="1" max="10" value={rpe} onChange={(event) => setRpe(event.target.value)} className="ml-2 h-9 w-16 rounded-xl border border-[#343b34]/10 bg-white/55 px-2 text-sm outline-none focus:border-[#7f9277]" /></label></div><textarea aria-label="Activity note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Add a note about the effort, weather, or how your legs felt." className="mt-3 w-full resize-none rounded-2xl border border-[#343b34]/10 bg-white/55 px-3 py-2 text-sm outline-none focus:border-[#7f9277]" /><button type="button" onClick={save} className="tap mt-3 inline-flex items-center gap-2 rounded-xl bg-[#343b34] px-3 py-2 text-xs font-semibold text-white"><Save size={14} />Save feedback</button></div></div></GlassCard>;
}
