import type { Activity } from "./types";

export type HeartRateZone = {
  zone: 1 | 2 | 3 | 4 | 5;
  label: string;
  minPercent: number;
  maxPercent?: number;
  minBpm: number;
  maxBpm?: number;
  durationSec: number;
  percentage: number;
};

const zoneColors = ["#9aab9a", "#7f9277", "#c29a51", "#bd755c", "#92514d"] as const;

export { zoneColors };

function valid(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function durationBetween(first: Activity["stream"][number], second: Activity["stream"][number], fallback: number) {
  if (first.timestamp && second.timestamp) {
    const seconds = (new Date(second.timestamp).getTime() - new Date(first.timestamp).getTime()) / 1000;
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
  }
  if (valid(first.distanceKm) && valid(second.distanceKm) && valid(first.paceSecPerKm) && second.distanceKm > first.distanceKm) {
    return (second.distanceKm - first.distanceKm) * first.paceSecPerKm;
  }
  return fallback;
}

function zoneForHeartRate(heartRate: number, maxHr: number): 1 | 2 | 3 | 4 | 5 {
  const ratio = heartRate / maxHr;
  if (ratio < 0.6) return 1;
  if (ratio < 0.7) return 2;
  if (ratio < 0.8) return 3;
  if (ratio < 0.9) return 4;
  return 5;
}

/** Estimate time spent in standard max-HR zones from FIT heart-rate samples. */
export function heartRateZones(activity: Activity, maxHr: number): HeartRateZone[] {
  const safeMaxHr = Math.max(100, Math.round(maxHr));
  const samples = activity.stream.filter((point) => valid(point.heartRate));
  const fallbackDuration = samples.length > 1 ? activity.durationSec / (samples.length - 1) : activity.durationSec;
  const durations = [0, 0, 0, 0, 0];

  samples.forEach((sample, index) => {
    const next = samples[index + 1];
    const durationSec = next ? durationBetween(sample, next, fallbackDuration) : 0;
    durations[zoneForHeartRate(sample.heartRate ?? 0, safeMaxHr) - 1] += durationSec;
  });

  const totalSec = durations.reduce((sum, duration) => sum + duration, 0);
  const thresholds = [
    { zone: 1 as const, label: "Easy", minPercent: 0, maxPercent: 0.6 },
    { zone: 2 as const, label: "Aerobic", minPercent: 0.6, maxPercent: 0.7 },
    { zone: 3 as const, label: "Tempo", minPercent: 0.7, maxPercent: 0.8 },
    { zone: 4 as const, label: "Threshold", minPercent: 0.8, maxPercent: 0.9 },
    { zone: 5 as const, label: "Hard", minPercent: 0.9 },
  ];

  return thresholds.map((threshold, index) => ({
    ...threshold,
    minBpm: threshold.minPercent === 0 ? 0 : Math.round(safeMaxHr * threshold.minPercent),
    maxBpm: threshold.maxPercent ? Math.round(safeMaxHr * threshold.maxPercent) - 1 : undefined,
    durationSec: Math.round(durations[index]),
    percentage: totalSec > 0 ? Math.round(durations[index] / totalSec * 100) : 0,
  }));
}
