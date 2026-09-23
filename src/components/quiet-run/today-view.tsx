"use client";

import { ArrowLeft, ArrowRight, Check, Clock3, Gauge, Route, Target, X } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { distanceForActivities, getWorkoutStatus } from "@/lib/progress";
import type { LocalState, PersonId, PlannedWorkout } from "@/lib/types";
import { GlassCard, Metric, StatusPill, cn, fullDate, shortDate, typeColors, workoutLabels } from "./shared";
import { RainForecast } from "./rain-forecast";

/** Weekly planning view: compare target distance with actual activity and resolve missed plans. */
export function TodayView({ state, personId, today, weekDates, weekOffset, onWeekChange, onWorkoutUpdate }: { state: LocalState; personId: PersonId; today: string; weekDates: string[]; weekOffset: number; onWeekChange: (offset: number) => void; onWorkoutUpdate: (workoutId: string, updates: Partial<Pick<PlannedWorkout, "date" | "status" | "postponedFrom">>) => void }) {
  const [selectedWorkout, setSelectedWorkout] = useState<PlannedWorkout>();
  const [showPostpone, setShowPostpone] = useState(false);
  const [postponeDate, setPostponeDate] = useState(today);
  const thisWeek = state.workouts.filter((workout) => workout.personId === personId && weekDates.includes(workout.date));
  const weekActivities = state.activities.filter((activity) => activity.personId === personId && weekDates.includes(activity.date));
  const plannedKm = thisWeek.reduce((sum, workout) => sum + (workout.distanceKm ?? 0), 0);
  const actualKm = distanceForActivities(weekActivities);
  const chartData = weekDates.map((date) => ({
    day: shortDate(date).split(" ")[0],
    planned: state.workouts.filter((workout) => workout.personId === personId && workout.date === date).reduce((sum, item) => sum + (item.distanceKm ?? 0), 0),
    actual: state.activities.filter((activity) => activity.personId === personId && activity.date === date).reduce((sum, item) => sum + item.distanceKm, 0),
  }));
  const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const selectedActivity = selectedWorkout ? weekActivities.find((activity) => activity.id === selectedWorkout.activityId) ?? weekActivities.find((activity) => activity.date === selectedWorkout.date && activity.type === selectedWorkout.type) : undefined;
  const selectedStatus = selectedWorkout ? getWorkoutStatus(selectedWorkout, selectedActivity) : "planned";
  const selectedDayLabel = selectedWorkout ? dayLabels[weekDates.indexOf(selectedWorkout.date)] ?? "Other day" : "";
  const statusEntries = thisWeek.map((workout) => ({ workout, status: getWorkoutStatus(workout, weekActivities.find((activity) => activity.id === workout.activityId) ?? weekActivities.find((activity) => activity.date === workout.date && activity.type === workout.type)) }));
  const completedCount = statusEntries.filter(({ status }) => status === "completed" || status === "exceeded").length;
  const missedCount = statusEntries.filter(({ status }) => status === "missed").length;
  const pendingCount = statusEntries.filter(({ workout, status }) => status === "planned" && workout.date < today).length;
  const postponedCount = thisWeek.filter((workout) => Boolean(workout.postponedFrom)).length;
  const weekTitle = weekOffset === 0 ? "This week" : weekOffset < 0 ? "Previous week" : "Next week";

  function closePlanDetails() {
    setSelectedWorkout(undefined);
    setShowPostpone(false);
  }

  function markPlanMissed() {
    if (!selectedWorkout) return;
    onWorkoutUpdate(selectedWorkout.id, { status: "missed" });
    closePlanDetails();
  }

  function openPostponeForm() {
    if (!selectedWorkout) return;
    setPostponeDate(selectedWorkout.date < today ? today : weekDates.find((date) => date > selectedWorkout.date) ?? today);
    setShowPostpone(true);
  }

  function postponePlan() {
    if (!selectedWorkout || !postponeDate || postponeDate === selectedWorkout.date) return;
    onWorkoutUpdate(selectedWorkout.id, { date: postponeDate, status: "planned", postponedFrom: selectedWorkout.date });
    closePlanDetails();
  }

  return (
    <div className="space-y-5">
      <GlassCard className="p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#85887f]">{weekTitle}</p><h1 className="mt-1 text-2xl font-medium tracking-[-.045em]">Planned &amp; Actual</h1></div><div className="text-right"><div className="text-xl font-semibold">{actualKm.toFixed(1)}<span className="ml-1 text-xs text-[#888b83]">/ {plannedKm} km</span></div><div className="text-xs text-[#7c8077]">{thisWeek.length} planned sessions</div></div></div>
        <div className="h-36 sm:h-44"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} barGap={2}><CartesianGrid vertical={false} stroke="rgba(67,70,64,.08)" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#858880", fontSize: 11 }} /><YAxis hide /><Tooltip cursor={{ fill: "rgba(127,146,119,.06)" }} contentStyle={{ borderRadius: 16, border: "1px solid rgba(0,0,0,.06)", background: "#fffdf8" }} /><Bar dataKey="planned" name="Planned" fill="#d9d5ca" radius={[8,8,4,4]} /><Bar dataKey="actual" name="Actual" fill="#7f9277" radius={[8,8,4,4]} /></BarChart></ResponsiveContainer></div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-2xl border border-[#7f9277]/15 bg-[#dce4d7]/45 px-3 py-2.5"><div className="text-[11px] text-[#687362]">Completed</div><div className="mt-1 text-lg font-semibold text-[#53644e]">{completedCount}<span className="ml-1 text-xs font-normal"> sessions</span></div></div>
          <div className="rounded-2xl border border-[#c29a51]/15 bg-[#eee2c7]/45 px-3 py-2.5"><div className="text-[11px] text-[#7b6334]">Needs update</div><div className="mt-1 text-lg font-semibold text-[#7b6334]">{pendingCount}<span className="ml-1 text-xs font-normal"> sessions</span></div></div>
          <div className="rounded-2xl border border-[#a75b55]/15 bg-[#ead9d7]/45 px-3 py-2.5"><div className="text-[11px] text-[#92514d]">Missed</div><div className="mt-1 text-lg font-semibold text-[#92514d]">{missedCount}<span className="ml-1 text-xs font-normal"> sessions</span></div></div>
          <div className="rounded-2xl border border-[#756e8e]/15 bg-[#e6e2ec]/55 px-3 py-2.5"><div className="text-[11px] text-[#756e8e]">Postponed</div><div className="mt-1 text-lg font-semibold text-[#756e8e]">{postponedCount}<span className="ml-1 text-xs font-normal"> sessions</span></div></div>
        </div>
      </GlassCard>
      <RainForecast />
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#85887f]">Week at a glance</p><h2 className="mt-1 text-xl font-medium">Monday — Sunday</h2><p className="mt-1 text-xs text-[#858880]">{shortDate(weekDates[0])} — {shortDate(weekDates[6])}</p></div><div className="flex items-center gap-1 rounded-2xl border border-white/70 bg-white/45 p-1"><button type="button" aria-label="Previous week" title="Previous week" onClick={() => onWeekChange(weekOffset - 1)} className="tap grid size-9 place-items-center rounded-xl text-[#687066] hover:bg-white/70"><ArrowLeft size={16} /></button><button type="button" onClick={() => onWeekChange(0)} disabled={weekOffset === 0} className="tap rounded-xl px-3 py-2 text-xs font-semibold text-[#586254] hover:bg-white/70 disabled:cursor-default disabled:opacity-40">Today</button><button type="button" aria-label="Next week" title="Next week" onClick={() => onWeekChange(weekOffset + 1)} className="tap grid size-9 place-items-center rounded-xl text-[#687066] hover:bg-white/70"><ArrowRight size={16} /></button></div></div>
        <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {weekDates.map((date, index) => {
            const workouts = thisWeek.filter((workout) => workout.date === date);
            const dayActivities = weekActivities.filter((activity) => activity.date === date);
            const isToday = date === today;
            return <article key={date} className={cn("flex min-h-[174px] flex-col rounded-[22px] border p-3", isToday ? "border-[#7f9277] bg-[#dce4d7]/40 ring-1 ring-[#7f9277]/30" : workouts.length ? "border-white/75 bg-white/58 shadow-[0_12px_30px_rgba(70,62,48,.055)]" : "border-dashed border-[#343b34]/12 bg-white/22")}>
              <div className="flex items-start justify-between"><div><div className="text-[11px] font-semibold text-[#6f756c]">{dayLabels[index]}</div><div className="mt-1 text-lg font-semibold text-[#30342f]">{new Date(date + "T12:00:00").getDate()}</div></div><span className={cn("size-2 rounded-full", workouts.length ? "bg-[#bd755c]" : "bg-[#c9c9c0]")} /></div>
              {workouts.length ? <div className="mt-4 space-y-2">{workouts.map((workout) => { const activity = dayActivities.find((item) => item.id === workout.activityId) ?? dayActivities.find((item) => item.type === workout.type); const status = getWorkoutStatus(workout, activity); const isPastPending = !activity && status === "planned" && workout.date < today; return <button type="button" key={workout.id} onClick={() => { setSelectedWorkout(workout); setShowPostpone(false); setPostponeDate(today); }} className="w-full rounded-2xl bg-white/62 p-2.5 text-left transition hover:bg-white/90 hover:shadow-sm"><div className="flex items-start gap-2"><span className="mt-1 h-8 w-1 rounded-full" style={{ backgroundColor: typeColors[workout.type] }} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="truncate text-xs font-semibold">{workout.title}</div>{activity && <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#7f9277] text-white"><Check size={12} strokeWidth={2.5} /></span>}</div><div className="mt-1 text-[10px] text-[#7d8178]">{workoutLabels[workout.type]}{workout.distanceKm ? " · " + workout.distanceKm + " km" : ""}</div></div></div><div className="mt-2 flex items-center justify-between gap-1">{isPastPending ? <span className="inline-flex items-center rounded-full bg-[#eee2c7] px-2.5 py-1 text-[11px] font-semibold text-[#7b6334]">Needs update</span> : <StatusPill status={status} />}<span className="text-[10px] font-medium text-[#777b72]">{activity ? activity.distanceKm.toFixed(1) + " km" : "—"}</span></div>{workout.postponedFrom && <div className="mt-1 text-[10px] text-[#756e8e]">Moved from {shortDate(workout.postponedFrom)}</div>}</button>})}</div> : <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-xs text-[#a0a39a]"><span className="grid size-9 place-items-center rounded-xl bg-white/35 text-base">—</span><span>Open</span><span>Plan from the Plan page</span></div>}
            </article>;
          })}
        </div>
      </section>
      {selectedWorkout && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#293029]/30 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePlanDetails(); }}><GlassCard className="w-full max-w-lg rounded-b-none rounded-t-[28px] p-5 sm:rounded-[28px] sm:p-6" role="dialog" aria-modal="true" aria-label={selectedWorkout.title}><div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#85887f]">{selectedDayLabel} · {fullDate(selectedWorkout.date)}</p><h2 className="mt-2 text-2xl font-medium tracking-[-.045em]">{selectedWorkout.title}</h2></div><button type="button" aria-label="Close plan details" title="Close plan details" onClick={closePlanDetails} className="tap grid place-items-center rounded-2xl bg-white/55"><X size={18} aria-hidden="true" /></button></div><div className="mb-5 flex items-center justify-between rounded-2xl bg-[#dce4d7]/70 p-3"><div className="flex items-center gap-2 text-sm font-semibold"><span className="h-8 w-1 rounded-full" style={{ backgroundColor: typeColors[selectedWorkout.type] }} />{workoutLabels[selectedWorkout.type]}</div><StatusPill status={selectedStatus} /></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Target" value={selectedWorkout.distanceKm ? String(selectedWorkout.distanceKm) : "—"} suffix={selectedWorkout.distanceKm ? "km" : "rest"} icon={Route} /><Metric label="Duration" value={selectedWorkout.durationMin ? String(selectedWorkout.durationMin) : "—"} suffix={selectedWorkout.durationMin ? "min" : ""} icon={Clock3} /><Metric label="Pace" value={selectedWorkout.paceMin ? selectedWorkout.paceMin.toFixed(1) + "–" + (selectedWorkout.paceMax?.toFixed(1) ?? "") : "Easy"} suffix={selectedWorkout.paceMin ? "min/km" : ""} icon={Gauge} /><Metric label="Actual" value={selectedActivity ? selectedActivity.distanceKm.toFixed(1) : "—"} suffix={selectedActivity ? "km" : "not yet"} icon={Target} /></div><div className="mt-5 rounded-2xl border border-[#343b34]/8 bg-white/42 p-4 text-sm leading-6 text-[#74786f]">{selectedWorkout.note ?? "Listen to your body and come back to record how the run felt."}</div>{selectedWorkout.postponedFrom && <div className="mt-3 rounded-2xl bg-[#e6e2ec]/55 p-3 text-xs text-[#756e8e]">This plan was moved from {fullDate(selectedWorkout.postponedFrom)}</div>}{!selectedActivity && selectedStatus === "planned" && <div className="mt-5 border-t border-[#343b34]/8 pt-5"><p className="mb-3 text-xs font-semibold uppercase tracking-[.14em] text-[#85887f]">Did not follow the plan?</p>{showPostpone ? <div className="space-y-3"><label className="block text-xs font-medium text-[#72766d]">Move to<input type="date" min={today} value={postponeDate} onChange={(event) => setPostponeDate(event.target.value)} className="mt-1.5 h-12 w-full rounded-2xl border border-[#343b34]/10 bg-white/55 px-3 text-sm outline-none focus:border-[#7f9277]" /></label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setShowPostpone(false)} className="tap rounded-2xl border border-[#343b34]/12 bg-white/45 text-sm font-semibold">Cancel</button><button type="button" disabled={!postponeDate || postponeDate === selectedWorkout.date} onClick={postponePlan} className="tap rounded-2xl bg-[#343b34] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Confirm move</button></div></div> : <div className="grid grid-cols-2 gap-2"><button type="button" onClick={markPlanMissed} className="tap rounded-2xl border border-[#a75b55]/25 bg-[#ead9d7]/65 text-sm font-semibold text-[#92514d]">Mark as missed</button><button type="button" onClick={openPostponeForm} className="tap rounded-2xl bg-[#343b34] text-sm font-semibold text-white">Move plan</button></div>}</div>}</GlassCard></div>}
    </div>
  );
}

