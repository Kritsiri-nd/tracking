import type { Activity } from "./types";

export type ActivityStatistics = {
  distanceKm: number;
  sessions: number;
  durationSec: number;
  paceSecPerKm?: number;
  avgHr?: number;
  elevationGainM: number;
  calories: number;
};

export type MonthlyActivityStatistics = ActivityStatistics & {
  month: string;
};

function finite(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Aggregate run metrics without rounding until the UI decides how to display them. */
export function summarizeActivities(activities: Activity[]): ActivityStatistics {
  const distanceKm = activities.reduce((sum, activity) => sum + (finite(activity.distanceKm) ? activity.distanceKm : 0), 0);
  const durationSec = activities.reduce((sum, activity) => sum + (finite(activity.durationSec) ? activity.durationSec : 0), 0);
  const heartRates = activities.filter((activity) => finite(activity.avgHr));
  const heartRateWeight = heartRates.reduce((sum, activity) => sum + activity.durationSec, 0);
  const weightedHeartRate = heartRates.reduce((sum, activity) => sum + (activity.avgHr ?? 0) * activity.durationSec, 0);

  return {
    distanceKm,
    sessions: activities.length,
    durationSec,
    paceSecPerKm: distanceKm > 0 ? durationSec / distanceKm : undefined,
    avgHr: heartRateWeight > 0 ? weightedHeartRate / heartRateWeight : undefined,
    elevationGainM: activities.reduce((sum, activity) => sum + (activity.elevationGainM ?? 0), 0),
    calories: activities.reduce((sum, activity) => sum + (activity.calories ?? 0), 0),
  };
}

/** Build a January-to-December report for a calendar year. */
export function monthlyStatistics(activities: Activity[], year: number): MonthlyActivityStatistics[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    return { month, ...summarizeActivities(activities.filter((activity) => activity.date.slice(0, 7) === month)) };
  });
}

export function yearStatistics(activities: Activity[], year: number) {
  return summarizeActivities(activities.filter((activity) => activity.date.startsWith(`${year}-`)));
}
