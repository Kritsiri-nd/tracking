"use client";

import { ArrowDownRight, ArrowUpRight, CheckCircle2, Clock3, Footprints, Route, Target } from "lucide-react";
import { formatDuration } from "@/lib/progress";
import type { Activity, PersonId, PlannedWorkout } from "@/lib/types";
import { GlassCard, Metric, cn } from "./shared";

type WeekSummary = {
  plannedKm: number;
  actualKm: number;
  durationSec: number;
  sessions: number;
  completed: number;
  missed: number;
  pending: number;
};

function summarizeWeek(dates: string[], activities: Activity[], workouts: PlannedWorkout[], personId: PersonId): WeekSummary {
  const weekActivities = activities.filter((activity) => activity.personId === personId && dates.includes(activity.date));
  const weekWorkouts = workouts.filter((workout) => workout.personId === personId && dates.includes(workout.date));
  const completed = weekWorkouts.filter((workout) => weekActivities.some((activity) => activity.id === workout.activityId || (activity.date === workout.date && activity.type === workout.type))).length;
  const missed = weekWorkouts.filter((workout) => workout.status === "missed").length;
  return {
    plannedKm: weekWorkouts.reduce((sum, workout) => sum + (workout.distanceKm ?? 0), 0),
    actualKm: weekActivities.reduce((sum, activity) => sum + activity.distanceKm, 0),
    durationSec: weekActivities.reduce((sum, activity) => sum + activity.durationSec, 0),
    sessions: weekActivities.length,
    completed,
    missed,
    pending: Math.max(0, weekWorkouts.length - completed - missed),
  };
}

function changeLabel(current: number, previous: number, suffix: string) {
  if (!previous && !current) return "No change";
  if (!previous) return `+${current.toFixed(1)}${suffix}`;
  const percent = Math.round(((current - previous) / previous) * 100);
  return `${percent >= 0 ? "+" : ""}${percent}% vs last week`;
}

/** A short weekly reflection that makes the plan actionable after the week ends. */
export function WeeklyReview({ weekDates, previousWeekDates, activities, workouts, personId }: { weekDates: string[]; previousWeekDates: string[]; activities: Activity[]; workouts: PlannedWorkout[]; personId: PersonId }) {
  const current = summarizeWeek(weekDates, activities, workouts, personId);
  const previous = summarizeWeek(previousWeekDates, activities, workouts, personId);
  const completion = current.plannedKm ? Math.min(100, Math.round((current.actualKm / current.plannedKm) * 100)) : 0;
  const distanceChange = current.actualKm - previous.actualKm;
  const ChangeIcon = distanceChange >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#85887f]">Weekly review</p><h2 className="mt-1 text-xl font-medium">How your week moved</h2><p className="mt-1 text-sm text-[#777b73]">A quick check against your plan and last week.</p></div><div className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold", completion >= 80 ? "bg-[#dce4d7] text-[#53644e]" : "bg-[#eee2c7] text-[#7b6334]")}><CheckCircle2 size={14} />{completion}% of plan</div></div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Distance" value={current.actualKm.toFixed(1)} suffix="km" icon={Route} /><Metric label="Run time" value={formatDuration(current.durationSec)} icon={Clock3} /><Metric label="Sessions" value={String(current.sessions)} icon={Footprints} /><Metric label="Plan" value={`${current.completed}/${current.completed + current.pending + current.missed}`} icon={Target} /></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-[#343b34]/8 bg-white/38 p-3"><div className="flex items-center gap-2 text-xs font-semibold text-[#777b73]"><ChangeIcon size={15} className={distanceChange >= 0 ? "text-[#7f9277]" : "text-[#a75b55]"} />Distance trend</div><p className="mt-2 text-sm font-semibold">{changeLabel(current.actualKm, previous.actualKm, " km")}</p></div><div className="rounded-2xl border border-[#343b34]/8 bg-white/38 p-3"><div className="text-xs font-semibold text-[#777b73]">Completed</div><p className="mt-2 text-sm font-semibold text-[#53644e]">{current.completed} sessions</p></div><div className="rounded-2xl border border-[#343b34]/8 bg-white/38 p-3"><div className="text-xs font-semibold text-[#777b73]">Needs attention</div><p className="mt-2 text-sm font-semibold text-[#92514d]">{current.missed} missed · {current.pending} open</p></div></div>
    </GlassCard>
  );
}
