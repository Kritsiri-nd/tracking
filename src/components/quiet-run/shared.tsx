import { Footprints, Route } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { BANGKOK_TIME_ZONE_NAME, shiftBangkokDateKey } from "@/lib/date";
import type { WorkoutStatus, WorkoutType } from "@/lib/types";

export type Tab = "today" | "calendar" | "upload" | "progress" | "gear";

export const workoutLabels: Record<WorkoutType, string> = {
  easy: "Easy", long: "Long run", tempo: "Tempo", interval: "Interval", recovery: "Recovery", race: "Race", rest: "Rest",
};

export const statusLabels: Record<WorkoutStatus, string> = {
  planned: "Planned", completed: "On target", partial: "Partly done", exceeded: "Over target", missed: "Missed",
};

export const typeColors: Record<WorkoutType, string> = {
  easy: "#7f9277", long: "#bd755c", tempo: "#c29a51", interval: "#756e8e", recovery: "#9aab9a", race: "#a75b55", rest: "#a8aaa4",
};

/** Join Tailwind class names while ignoring conditional values. */
export function cn(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function shortDate(date: string) {
  return new Intl.DateTimeFormat("en", { timeZone: BANGKOK_TIME_ZONE_NAME, weekday: "short", day: "numeric" }).format(new Date(`${date}T12:00:00Z`));
}

export function fullDate(date: string) {
  return new Intl.DateTimeFormat("en", { timeZone: BANGKOK_TIME_ZONE_NAME, weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00Z`));
}

export function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: BANGKOK_TIME_ZONE_NAME }).format(new Date(`${month}-01T12:00:00Z`));
}

export function monthKey(date: string) {
  return date.slice(0, 7);
}

export function shiftMonthKey(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1, 12));
  return date.toISOString().slice(0, 7);
}

/** Build a Monday-first calendar grid, including the leading/trailing days. */
export function getMonthCalendarDates(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDate = `${month}-01`;
  const firstDay = new Date(`${firstDate}T12:00:00Z`).getUTCDay();
  const mondayOffset = firstDay === 0 ? -6 : 1 - firstDay;
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const leadingCells = mondayOffset < 0 ? -mondayOffset : 0;
  const totalCells = Math.ceil((leadingCells + daysInMonth) / 7) * 7;
  const startDate = shiftBangkokDateKey(firstDate, mondayOffset);
  return Array.from({ length: totalCells }, (_, index) => shiftBangkokDateKey(startDate, index));
}

export function GlassCard({ children, className, ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return <section {...props} className={cn("glass rounded-[28px]", className)}>{children}</section>;
}

export function StatusPill({ status }: { status: WorkoutStatus }) {
  const classes = {
    planned: "bg-stone-100 text-stone-600",
    completed: "bg-[#dce4d7] text-[#53644e]",
    partial: "bg-[#eee2c7] text-[#7b6334]",
    exceeded: "bg-[#efddd5] text-[#925844]",
    missed: "bg-[#ead9d7] text-[#92514d]",
  }[status];
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold", classes)}>{statusLabels[status]}</span>;
}

export function Metric({ label, value, suffix, icon: Icon }: { label: string; value: string; suffix?: string; icon?: LucideIcon }) {
  return (
    <div className="rounded-2xl border border-white/65 bg-white/42 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[.14em] text-[#84877f]">{Icon && <Icon size={13} />}{label}</div>
      <div className="text-xl font-semibold tracking-[-.04em] text-[#30342f]">{value}<span className="ml-1 text-xs font-medium tracking-normal text-[#858880]">{suffix}</span></div>
    </div>
  );
}

export { Footprints, Route };
