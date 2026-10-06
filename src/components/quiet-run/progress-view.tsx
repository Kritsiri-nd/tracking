"use client";

import { ArrowLeft, ArrowRight, CalendarDays, Clock3, Download, Footprints, HeartPulse, Route, Search, Target, TrendingUp, Trophy, Zap } from "lucide-react";
import { FormEvent, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { downloadActivitiesCsv } from "@/lib/download";
import { monthlyStatistics, summarizeActivities, yearStatistics } from "@/lib/statistics";
import { formatDuration, formatPace, paceMinutesPerKm } from "@/lib/progress";
import type { Activity, LocalState, MonthlyGoal, PersonId, WorkoutType } from "@/lib/types";
import { GlassCard, Metric, PageIntro, cn, monthKey, monthLabel, shortDate, typeColors, workoutLabels } from "./shared";

type ProgressSection = "overview" | "goals" | "statistics";
type ActivityRange = "recent" | "month" | "year" | "all";

const chartTooltipStyle = { borderRadius: 16, border: "1px solid rgba(0,0,0,.06)", background: "#fffdf8" };

function chartValue(value: number | undefined, suffix = "") {
  return value === undefined || !Number.isFinite(value) ? "—" : `${value}${suffix}`;
}

/** Progress workspace grouped into overview, goals, and year-based statistics. */
export function ProgressView({ state, personId, today, onGoalSave, onOpenActivity }: { state: LocalState; personId: PersonId; today: string; onGoalSave: (goal: MonthlyGoal) => void; onOpenActivity: (activity: Activity) => void }) {
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [section, setSection] = useState<ProgressSection>("overview");
  const [goalDistance, setGoalDistance] = useState("");
  const [goalSessions, setGoalSessions] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const [activityRange, setActivityRange] = useState<ActivityRange>("all");
  const [activityType, setActivityType] = useState<"all" | WorkoutType>("all");
  const [statisticsYear, setStatisticsYear] = useState(() => Number(today.slice(0, 4)));
  const activities = state.activities.filter((activity) => activity.personId === personId);
  const workouts = state.workouts.filter((workout) => workout.personId === personId);
  const currentMonth = monthKey(today);
  const goal = state.monthlyGoals.find((item) => item.personId === personId && item.month === currentMonth);
  const currentMonthActivities = activities.filter((activity) => monthKey(activity.date) === currentMonth);
  const currentMonthStats = summarizeActivities(currentMonthActivities);
  const lifetimeStats = summarizeActivities(activities);
  const yearStats = yearStatistics(activities, statisticsYear);
  const monthlyData = monthlyStatistics(activities, statisticsYear).map((item) => ({
    ...item,
    label: new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(`${item.month}-01T12:00:00Z`)),
    distance: Number(item.distanceKm.toFixed(1)),
    hours: Number((item.durationSec / 3600).toFixed(1)),
  }));
  const trend = activities
    .filter((activity) => activity.date.startsWith(`${statisticsYear}-`))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((activity) => ({
      date: new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(`${activity.date}T12:00:00Z`)),
      pace: paceMinutesPerKm(activity.paceSecPerKm),
      hr: activity.avgHr,
      distance: Number(activity.distanceKm.toFixed(1)),
    }));
  const types = Object.entries(workoutLabels)
    .map(([key, label]) => ({ type: label, key, distance: Number(activities.filter((item) => item.date.startsWith(`${statisticsYear}-`) && item.type === key).reduce((sum, item) => sum + item.distanceKm, 0).toFixed(1)) }))
    .filter((item) => item.distance > 0);
  const adherenceData = monthlyData.map((month) => ({
    label: month.label,
    planned: workouts.filter((workout) => workout.date.slice(0, 7) === month.month).reduce((sum, workout) => sum + (workout.distanceKm ?? 0), 0),
    actual: month.distanceKm,
  }));
  const activityHistory = [...activities]
    .filter((activity) => {
      const query = activitySearch.trim().toLowerCase();
      const matchesQuery = !query || `${activity.title} ${activity.source} ${activity.importedFileName ?? ""}`.toLowerCase().includes(query);
      const matchesType = activityType === "all" || activity.type === activityType;
      const matchesRange = activityRange === "all"
        || (activityRange === "month" && monthKey(activity.date) === currentMonth)
        || (activityRange === "year" && activity.date.startsWith(`${today.slice(0, 4)}-`));
      return matchesQuery && matchesType && matchesRange;
    })
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const recentActivities = activityRange === "recent" ? activityHistory.slice(0, 6) : activityHistory;

  function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetDistanceKm = Number(goalDistance);
    const targetSessions = Number(goalSessions);
    if ((!Number.isFinite(targetDistanceKm) || targetDistanceKm <= 0) && (!Number.isFinite(targetSessions) || targetSessions <= 0)) return;
    onGoalSave({ id: goal?.id ?? `goal-${personId}-${currentMonth}`, personId, month: currentMonth, targetDistanceKm: targetDistanceKm > 0 ? targetDistanceKm : undefined, targetSessions: targetSessions > 0 ? targetSessions : undefined });
    setShowGoalForm(false);
  }

  return (
    <div className="space-y-5">
      <PageIntro eyebrow="Training intelligence" title="Progress" description="Turn every run into a clearer picture of your consistency, effort, and direction." />

      <div role="tablist" aria-label="Progress sections" className="flex w-full gap-1 overflow-x-auto rounded-2xl border border-white/70 bg-white/45 p-1">
        {(["overview", "goals", "statistics"] as ProgressSection[]).map((item) => <button key={item} type="button" role="tab" aria-selected={section === item} onClick={() => setSection(item)} className={cn("tap min-w-24 flex-1 rounded-xl px-3 py-2 text-xs font-semibold capitalize", section === item ? "bg-[#343b34] text-white" : "text-[#687066]")}>{item}</button>)}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Distance" value={lifetimeStats.distanceKm.toFixed(1)} suffix="km" icon={Route} />
        <Metric label="Runs" value={String(lifetimeStats.sessions)} icon={Footprints} />
        <Metric label="Avg HR" value={lifetimeStats.avgHr ? lifetimeStats.avgHr.toFixed(0) : "—"} suffix="bpm" icon={HeartPulse} />
        <Metric label="Planned" value={String(workouts.length)} suffix="sessions" icon={Target} />
      </div>

      {section !== "statistics" && <>
        <GlassCard className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#85887f]">Monthly goal</p><h2 className="mt-1 text-xl font-medium">{monthLabel(currentMonth)}</h2><p className="mt-1 text-sm text-[#777b73]">{formatDuration(currentMonthStats.durationSec)} h · {currentMonthStats.sessions} sessions</p></div>
            <button type="button" onClick={() => { setGoalDistance(goal?.targetDistanceKm ? String(goal.targetDistanceKm) : ""); setGoalSessions(goal?.targetSessions ? String(goal.targetSessions) : ""); setShowGoalForm((visible) => !visible); }} className="tap rounded-full bg-[#343b34] px-4 py-2 text-xs font-semibold text-white">{goal ? "Edit goal" : "Set goal"}</button>
          </div>
          {goal ? <div className="mt-5 grid gap-4 sm:grid-cols-2"><GoalProgress label="Distance" value={currentMonthStats.distanceKm} target={goal.targetDistanceKm} suffix="km" color="sage" /><GoalProgress label="Sessions" value={currentMonthStats.sessions} target={goal.targetSessions} suffix="" color="clay" /></div> : <div className="mt-5 rounded-2xl border border-dashed border-[#343b34]/12 p-4 text-sm text-[#858880]">Set a distance or session target for this month.</div>}
          {showGoalForm && <form onSubmit={saveGoal} className="mt-5 grid gap-3 border-t border-[#343b34]/8 pt-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><label className="text-xs font-medium text-[#72766d]">Distance target (km)<input type="number" min="0" step="1" value={goalDistance} onChange={(event) => setGoalDistance(event.target.value)} placeholder="80" className="mt-1.5 h-11 w-full rounded-2xl border border-[#343b34]/10 bg-white/55 px-3 text-sm outline-none focus:border-[#7f9277]" /></label><label className="text-xs font-medium text-[#72766d]">Session target<input type="number" min="0" step="1" value={goalSessions} onChange={(event) => setGoalSessions(event.target.value)} placeholder="12" className="mt-1.5 h-11 w-full rounded-2xl border border-[#343b34]/10 bg-white/55 px-3 text-sm outline-none focus:border-[#7f9277]" /></label><button type="submit" className="tap h-11 rounded-2xl bg-[#343b34] px-4 text-sm font-semibold text-white">Save goal</button></form>}
        </GlassCard>
        {section === "overview" && <GlassCard className="p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#85887f]">Activity detail</p><h2 className="mt-1 text-xl font-medium">Activity history</h2><p className="mt-1 text-xs text-[#858880]">{activityHistory.length} matching activit{activityHistory.length === 1 ? "y" : "ies"}</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" disabled={!recentActivities.length} onClick={() => downloadActivitiesCsv(recentActivities)} title="Export the runs shown below" className="tap inline-flex items-center gap-2 rounded-xl bg-[#dce4d7]/60 px-3 py-2 text-xs font-semibold text-[#53644e] disabled:opacity-40"><Download size={14} />Export CSV</button><label className="relative"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#858880]" /><input aria-label="Search activities" value={activitySearch} onChange={(event) => setActivitySearch(event.target.value)} placeholder="Search runs" className="h-10 w-40 rounded-xl border border-[#343b34]/10 bg-white/55 pl-9 pr-3 text-xs outline-none focus:border-[#7f9277]" /></label><select aria-label="Activity type" value={activityType} onChange={(event) => setActivityType(event.target.value as "all" | WorkoutType)} className="h-10 rounded-xl border border-[#343b34]/10 bg-white/55 px-3 text-xs outline-none focus:border-[#7f9277]"><option value="all">All types</option>{Object.entries(workoutLabels).filter(([key]) => key !== "rest").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></div>
          <div className="mb-4 flex flex-wrap gap-1 rounded-2xl bg-white/38 p-1">{([{ value: "recent", label: "Recent" }, { value: "month", label: "This month" }, { value: "year", label: "This year" }, { value: "all", label: "All time" }] as const).map((item) => <button key={item.value} type="button" onClick={() => setActivityRange(item.value)} className={cn("tap rounded-xl px-3 py-2 text-xs font-semibold", activityRange === item.value ? "bg-[#343b34] text-white" : "text-[#687066]")}>{item.label}</button>)}</div>
          <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">{recentActivities.length ? recentActivities.map((activity) => <button type="button" key={activity.id} onClick={() => onOpenActivity(activity)} className="tap flex w-full items-center gap-3 rounded-2xl border border-white/70 bg-white/42 p-3 text-left transition hover:bg-white/75"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#dce4d7] text-[#53644e]"><Footprints size={17} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{activity.title}</span><span className="mt-1 block text-xs text-[#858880]">{shortDate(activity.date)} · {activity.distanceKm.toFixed(1)} km · {formatDuration(activity.durationSec)} h</span></span><ArrowRight size={16} className="text-[#8b8e86]" /></button>) : <div className="rounded-2xl border border-dashed border-[#343b34]/12 p-4 text-sm text-[#858880]">No activities match these filters.</div>}</div>
        </GlassCard>}
      </>}

      {section === "goals" && <GlassCard className="p-5 sm:p-6"><div className="flex items-start gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-[#eee2c7] text-[#7b6334]"><Trophy size={20} /></div><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#85887f]">Goal coaching</p><h2 className="mt-1 text-xl font-medium">Keep the target visible</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#777b73]">Your monthly goal is calculated from completed FIT activities. Open the Statistics tab to compare monthly volume, pace, elevation, and time.</p></div></div></GlassCard>}

      {section === "statistics" && <>
        <GlassCard className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#85887f]">Yearly statistics</p><h2 className="mt-1 text-xl font-medium">{statisticsYear} overview</h2></div>
            <div className="flex items-center gap-2"><button type="button" aria-label="Previous year" onClick={() => setStatisticsYear((year) => year - 1)} className="tap grid size-9 place-items-center rounded-xl bg-white/55"><ArrowLeft size={16} /></button><span className="min-w-16 text-center text-sm font-semibold">{statisticsYear}</span><button type="button" aria-label="Next year" onClick={() => setStatisticsYear((year) => year + 1)} className="tap grid size-9 place-items-center rounded-xl bg-white/55"><ArrowRight size={16} /></button></div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"><Metric label="Distance" value={yearStats.distanceKm.toFixed(1)} suffix="km" icon={Route} /><Metric label="Time" value={formatDuration(yearStats.durationSec)} suffix="h" icon={Clock3} /><Metric label="Runs" value={String(yearStats.sessions)} icon={Footprints} /><Metric label="Avg pace" value={yearStats.paceSecPerKm ? formatPace(yearStats.paceSecPerKm) : "—"} suffix="/km" icon={Zap} /><Metric label="Elevation" value={yearStats.elevationGainM.toFixed(0)} suffix="m" icon={TrendingUp} /><Metric label="Calories" value={yearStats.calories ? yearStats.calories.toLocaleString("en-US") : "—"} suffix="kcal" icon={Target} /></div>
          <div className="mt-6 h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyData}><CartesianGrid vertical={false} stroke="rgba(67,70,64,.08)" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#858880", fontSize: 10 }} /><YAxis hide /><Tooltip contentStyle={chartTooltipStyle} formatter={(value, name) => [name === "Distance (km)" ? `${value} km` : value, name]} /><Bar dataKey="distance" name="Distance (km)" fill="#7f9277" radius={[8, 8, 4, 4]} /></BarChart></ResponsiveContainer></div>
        </GlassCard>

        <div className="grid gap-5 xl:grid-cols-2">
          <GlassCard className="p-5"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#85887f]">Pace & effort</p><h2 className="mt-1 text-xl font-medium">Run trend</h2></div><TrendingUp size={20} className="text-[#7f9277]" /></div>{trend.length ? <><div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid vertical={false} stroke="rgba(67,70,64,.08)" /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#858880", fontSize: 11 }} /><YAxis yAxisId="left" hide /><YAxis yAxisId="right" hide orientation="right" /><Tooltip contentStyle={chartTooltipStyle} formatter={(value, name) => [name === "Pace min/km" ? `${Number(value).toFixed(2)} min/km` : `${value} bpm`, name]} /><Line yAxisId="left" type="monotone" connectNulls dataKey="pace" name="Pace min/km" stroke="#bd755c" strokeWidth={3} dot={{ r: 4, fill: "#bd755c" }} /><Line yAxisId="right" type="monotone" connectNulls dataKey="hr" name="Average HR (bpm)" stroke="#7f9277" strokeWidth={2} dot={{ r: 3, fill: "#7f9277" }} /></LineChart></ResponsiveContainer></div><div className="mt-2 flex gap-4 text-xs text-[#797d74]"><span><i className="mr-1.5 inline-block size-2 rounded-full bg-[#bd755c]" />Pace min/km</span><span><i className="mr-1.5 inline-block size-2 rounded-full bg-[#7f9277]" />Average HR (bpm)</span></div></> : <EmptyStatistics />}</GlassCard>
          <GlassCard className="p-5"><div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#85887f]">Workout balance</p><h2 className="mt-1 text-xl font-medium">Distance by type</h2></div>{types.length ? <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={types} layout="vertical"><CartesianGrid horizontal={false} stroke="rgba(67,70,64,.08)" /><XAxis type="number" hide /><YAxis type="category" dataKey="type" axisLine={false} tickLine={false} width={74} tick={{ fill: "#777b73", fontSize: 11 }} /><Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [`${value} km`, "Distance"]} /><Bar dataKey="distance" name="Distance" radius={[0, 9, 9, 0]}>{types.map((item) => <Cell key={item.key} fill={typeColors[item.key as WorkoutType]} />)}</Bar></BarChart></ResponsiveContainer></div> : <EmptyStatistics />}</GlassCard>
        </div>

        <GlassCard className="p-5"><div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#85887f]">Adherence</p><h2 className="mt-1 text-xl font-medium">Planned vs actual distance by month</h2></div><div className="h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={adherenceData}><defs><linearGradient id="actual-distance" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7f9277" stopOpacity={.34} /><stop offset="95%" stopColor="#7f9277" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="rgba(67,70,64,.08)" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#858880", fontSize: 11 }} /><YAxis hide /><Tooltip contentStyle={chartTooltipStyle} formatter={(value, name) => [`${value} km`, name === "planned" ? "Planned" : "Actual"]} /><Area type="monotone" dataKey="planned" name="planned" stroke="#aaa69b" fill="transparent" strokeDasharray="5 5" /><Area type="monotone" dataKey="actual" name="actual" stroke="#7f9277" strokeWidth={3} fill="url(#actual-distance)" /></AreaChart></ResponsiveContainer></div></GlassCard>

        <GlassCard className="overflow-hidden p-0"><div className="border-b border-[#343b34]/8 p-5"><div className="flex items-center gap-3"><CalendarDays size={19} className="text-[#7f9277]" /><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#85887f]">Monthly breakdown</p><h2 className="mt-1 text-xl font-medium">Every month in {statisticsYear}</h2></div></div></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-white/35 text-xs uppercase tracking-[.12em] text-[#858880]"><tr><th className="px-5 py-3 font-semibold">Month</th><th className="px-3 py-3 font-semibold">Runs</th><th className="px-3 py-3 font-semibold">Distance</th><th className="px-3 py-3 font-semibold">Time</th><th className="px-3 py-3 font-semibold">Avg pace</th><th className="px-3 py-3 font-semibold">Avg HR</th><th className="px-5 py-3 text-right font-semibold">Elevation</th></tr></thead><tbody className="divide-y divide-[#343b34]/7">{monthlyData.map((item) => <tr key={item.month} className={item.month === currentMonth && statisticsYear === Number(today.slice(0, 4)) ? "bg-[#dce4d7]/30" : ""}><td className="px-5 py-3 font-semibold">{monthLabel(item.month)}</td><td className="px-3 py-3">{item.sessions}</td><td className="px-3 py-3">{item.distance.toFixed(1)} km</td><td className="px-3 py-3">{formatDuration(item.durationSec)} h</td><td className="px-3 py-3">{item.paceSecPerKm ? `${formatPace(item.paceSecPerKm)} /km` : "—"}</td><td className="px-3 py-3">{chartValue(item.avgHr && Math.round(item.avgHr), " bpm")}</td><td className="px-5 py-3 text-right">{item.elevationGainM ? `${item.elevationGainM.toFixed(0)} m` : "—"}</td></tr>)}</tbody></table></div></GlassCard>
      </>}
    </div>
  );
}

function GoalProgress({ label, value, target, suffix, color }: { label: string; value: number; target?: number; suffix: string; color: "sage" | "clay" }) {
  const percentage = target ? Math.min(100, value / target * 100) : 0;
  return <div><div className="mb-2 flex items-center justify-between text-xs"><span>{label}</span><span className="font-semibold">{value.toFixed(label === "Distance" ? 1 : 0)}{suffix ? ` ${suffix}` : ""} / {target ?? "—"}{suffix ? ` ${suffix}` : ""}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#e9e6dc]"><div className={cn("h-full rounded-full", color === "sage" ? "bg-[#7f9277]" : "bg-[#bd755c]")} style={{ width: `${percentage}%` }} /></div></div>;
}

function EmptyStatistics() {
  return <div className="grid h-64 place-items-center rounded-2xl border border-dashed border-[#343b34]/12 p-5 text-center text-sm text-[#858880]">No completed activities in this year yet.</div>;
}
