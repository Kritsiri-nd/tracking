"use client";

import { Activity as ActivityIcon, Clock3, Footprints, Route, TrendingUp } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GlassCard, Metric, cn, shortDate } from "./shared";
import type { Activity, PersonId, PlannedWorkout } from "@/lib/types";

function formatDuration(seconds: number) {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}

function formatPace(secondsPerKm: number) {
  if (!secondsPerKm || !Number.isFinite(secondsPerKm)) return "--";
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

type WeeklyOverviewProps = {
  weekDates: string[];
  activities: Activity[];
  workouts: PlannedWorkout[];
  personId: PersonId;
  plannedKm: number;
  actualKm: number;
};

const runnerSlides = [
  { src: "/stridebook-runners.png", alt: "Two runners ready for the week", eyebrow: "Your week in motion", caption: "Keep moving together." },
  { src: "/stridebook-runners-race.png", alt: "Two runners celebrating after a race", eyebrow: "Race day energy", caption: "Show up. Finish strong." },
  { src: "/stridebook-runners-everyday.png", alt: "Two friends enjoying an active day", eyebrow: "Everyday movement", caption: "Build a rhythm that lasts." },
];

/** A compact weekly performance summary powered by the same Today data. */
export function WeeklyOverview({ weekDates, activities, workouts, personId, plannedKm, actualKm }: WeeklyOverviewProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const weekActivities = activities.filter((activity) => activity.personId === personId && weekDates.includes(activity.date));
  const weekWorkouts = workouts.filter((workout) => workout.personId === personId && weekDates.includes(workout.date));
  const durationSec = weekActivities.reduce((sum, activity) => sum + activity.durationSec, 0);
  const averagePace = actualKm > 0 ? durationSec / actualKm : 0;
  const activeDays = new Set(weekActivities.map((activity) => activity.date)).size;
  const completion = plannedKm > 0 ? Math.min(100, (actualKm / plannedKm) * 100) : 0;
  const chartData = weekDates.map((date) => ({
    day: shortDate(date).split(" ")[0],
    planned: weekWorkouts.filter((workout) => workout.date === date).reduce((sum, workout) => sum + (workout.distanceKm ?? 0), 0),
    actual: weekActivities.filter((activity) => activity.date === date).reduce((sum, activity) => sum + activity.distanceKm, 0),
  }));

  useEffect(() => {
    const timer = window.setInterval(() => setActiveSlide((current) => (current + 1) % runnerSlides.length), 3000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <GlassCard className="overflow-hidden p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_280px] sm:gap-5">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#a6ff00] text-[#111411]"><TrendingUp size={20} /></div><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#85887f]">Weekly overview</p><h2 className="mt-1 text-xl font-medium tracking-[-.03em]">Your week in motion</h2><p className="mt-1 text-sm text-[#777b73]">Planned against what you actually ran.</p></div></div><div className="rounded-full border border-[#a6ff00]/20 bg-[#a6ff00]/10 px-3 py-1.5 text-xs font-semibold text-[#a6ff00]">{Math.round(completion)}% of plan</div></div>
          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Metric label="Distance" value={actualKm.toFixed(1)} suffix="km" icon={Route} />
            <Metric label="Run time" value={formatDuration(durationSec)} icon={Clock3} />
            <Metric label="Sessions" value={String(weekActivities.length)} suffix={`/ ${weekWorkouts.length}`} icon={Footprints} />
            <Metric label="Avg pace" value={formatPace(averagePace)} suffix={averagePace ? "/km" : undefined} icon={ActivityIcon} />
          </div>
          <div className="mt-3 rounded-2xl border border-white/8 bg-black/10 p-3">
            <div className="mb-1 flex items-center justify-between gap-3"><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#85887f]">Weekly performance</p><div className="flex items-center gap-2 text-[10px] text-[#92968d]"><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#62695e]" />Planned</span><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#a6ff00]" />Actual</span></div></div>
            <div className="h-24"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} barGap={3} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}><CartesianGrid vertical={false} stroke="rgba(255,255,255,.08)" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#858b81", fontSize: 10 }} /><YAxis hide /><Tooltip cursor={{ fill: "rgba(166,255,0,.05)" }} contentStyle={{ borderRadius: 14, border: "1px solid rgba(255,255,255,.10)", background: "#242824", color: "#f2f4ee", fontSize: 12 }} /><Bar dataKey="planned" name="Planned" fill="#62695e" radius={[6, 6, 3, 3]} /><Bar dataKey="actual" name="Actual" fill="#a6ff00" radius={[6, 6, 3, 3]} /></BarChart></ResponsiveContainer></div>
          </div>
        </div>
        <div className="dashboard-people-art dashboard-runner-carousel relative h-56 overflow-hidden rounded-3xl border border-white/8 bg-black/10 sm:h-80" role="region" aria-roledescription="carousel" aria-label="Stridebook runner gallery">
          <div className="dashboard-people-glow" />
          {runnerSlides.map((slide, index) => <div key={slide.src} className={cn("absolute inset-0 transition-opacity duration-500", activeSlide === index ? "opacity-100" : "pointer-events-none opacity-0")} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${runnerSlides.length}`}><Image src={slide.src} alt={slide.alt} fill sizes="(max-width: 640px) 100vw, 280px" className="relative z-10 object-contain object-bottom drop-shadow-[0_16px_18px_rgba(0,0,0,.28)]" priority={index === 0} /></div>)}
          <div className="dashboard-carousel-shade" />
          <div className="dashboard-carousel-copy"><span>{runnerSlides[activeSlide].eyebrow}</span><strong>{runnerSlides[activeSlide].caption}</strong></div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[#858b81]"><span>{activeDays} active day{activeDays === 1 ? "" : "s"}</span><span>{shortDate(weekDates[0])} — {shortDate(weekDates[weekDates.length - 1])}</span></div>
    </GlassCard>
  );
}
