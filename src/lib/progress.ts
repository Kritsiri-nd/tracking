import type { Activity, ActivityLap, ActivityPoint, PlannedWorkout, WorkoutStatus } from "./types";

export function formatPace(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds)) return "—";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}

/** Convert a pace sample to chart minutes/km while ignoring paused/GPS outliers. */
export function paceMinutesPerKm(seconds?: number) {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0 || seconds > 15 * 60) return undefined;
  return Number((seconds / 60).toFixed(2));
}

export function formatDuration(seconds: number) {
  const totalMinutes = Math.max(0, Math.floor(seconds / 60));
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Display FIT cadence (stored as steps per minute) as steps per second. */
export function formatCadencePerSecond(cadence?: number) {
  if (cadence === undefined || !Number.isFinite(cadence)) return "—";
  return (cadence / 60).toFixed(1);
}

export function getWorkoutStatus(workout: PlannedWorkout, activity?: Activity): WorkoutStatus {
  if (!activity) return workout.status === "missed" ? "missed" : "planned";
  if (!workout.distanceKm) return "completed";
  const ratio = activity.distanceKm / workout.distanceKm;
  if (ratio < 0.5) return "missed";
  if (ratio < 0.9) return "partial";
  if (ratio > 1.1) return "exceeded";
  return "completed";
}

export function percent(value: number, target: number) {
  if (!target) return 0;
  return Math.round((value / target) * 100);
}

export function distanceForActivities(activities: Activity[]) {
  return activities.reduce((sum, activity) => sum + activity.distanceKm, 0);
}

export function average(values: Array<number | undefined>) {
  const filtered = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return filtered.length ? filtered.reduce((sum, value) => sum + value, 0) / filtered.length : 0;
}

type SplitSample = Pick<ActivityPoint, "distanceKm" | "paceSecPerKm" | "heartRate" | "cadence">;

function validNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Turns sampled activity data into complete, user-sized splits.
 * FIT files do not always contain lap messages, so this works from the
 * stream first and falls back to the original laps when the stream is sparse.
 */
function splitSamples(samples: SplitSample[], totalDistanceKm: number, splitDistanceKm: number, fallbackPace: number, fallbackHeartRate?: number, fallbackCadence?: number): ActivityLap[] {
  if (totalDistanceKm <= 0) return [];
  const ordered: SplitSample[] = [];
  let lastDistance = -1;

  for (const sample of samples) {
    const rawDistance = validNumber(sample.distanceKm);
    if (rawDistance === undefined) continue;
    const distanceKm = Math.min(totalDistanceKm, Math.max(0, rawDistance));
    if (distanceKm <= lastDistance + 0.0001) continue;
    ordered.push({ distanceKm, paceSecPerKm: validNumber(sample.paceSecPerKm), heartRate: validNumber(sample.heartRate), cadence: validNumber(sample.cadence) });
    lastDistance = distanceKm;
  }

  if (!ordered.length || ordered[0].distanceKm > 0) {
    ordered.unshift({ distanceKm: 0, paceSecPerKm: ordered[0]?.paceSecPerKm ?? fallbackPace, heartRate: ordered[0]?.heartRate ?? fallbackHeartRate, cadence: ordered[0]?.cadence ?? fallbackCadence });
  }
  if (ordered[ordered.length - 1].distanceKm < totalDistanceKm) {
    const last = ordered[ordered.length - 1];
    ordered.push({ distanceKm: totalDistanceKm, paceSecPerKm: last.paceSecPerKm ?? fallbackPace, heartRate: last.heartRate ?? fallbackHeartRate, cadence: last.cadence ?? fallbackCadence });
  }

  const splits: ActivityLap[] = [];
  let splitNumber = 1;
  let splitDurationSec = 0;
  let heartRateDistance = 0;
  let heartRateWeighted = 0;
  let cadenceDistance = 0;
  let cadenceWeighted = 0;

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const segmentDistanceKm = current.distanceKm - previous.distanceKm;
    if (segmentDistanceKm <= 0) continue;
    const pace = current.paceSecPerKm ?? previous.paceSecPerKm ?? fallbackPace;
    const segmentDurationSec = segmentDistanceKm * pace;
    const heartRate = current.heartRate ?? previous.heartRate ?? fallbackHeartRate;
    const cadence = current.cadence ?? previous.cadence ?? fallbackCadence;
    let segmentStartKm = previous.distanceKm;

    while (segmentStartKm < current.distanceKm - 0.0001) {
      const splitStartKm = (splitNumber - 1) * splitDistanceKm;
      const splitEndKm = Math.min(totalDistanceKm, splitNumber * splitDistanceKm);
      const partEndKm = Math.min(current.distanceKm, splitEndKm);
      const partDistanceKm = partEndKm - segmentStartKm;
      const partRatio = partDistanceKm / segmentDistanceKm;
      splitDurationSec += segmentDurationSec * partRatio;
      if (heartRate !== undefined) {
        heartRateDistance += partDistanceKm;
        heartRateWeighted += heartRate * partDistanceKm;
      }
      if (cadence !== undefined) {
        cadenceDistance += partDistanceKm;
        cadenceWeighted += cadence * partDistanceKm;
      }
      segmentStartKm = partEndKm;

      if (partEndKm >= splitEndKm - 0.0001) {
        const splitDistance = splitEndKm - splitStartKm;
        splits.push({
          lap: splitNumber,
          distanceKm: Number(splitDistance.toFixed(2)),
          durationSec: Math.round(splitDurationSec),
          paceSecPerKm: splitDistance > 0 ? splitDurationSec / splitDistance : undefined,
          avgHr: heartRateDistance > 0 ? Math.round(heartRateWeighted / heartRateDistance) : undefined,
          avgCadence: cadenceDistance > 0 ? Math.round(cadenceWeighted / cadenceDistance) : undefined,
        });
        splitNumber += 1;
        splitDurationSec = 0;
        heartRateDistance = 0;
        heartRateWeighted = 0;
        cadenceDistance = 0;
        cadenceWeighted = 0;
      }
    }
  }

  return splits;
}

/** Build 1 km, 5 km, 10 km, or custom splits for the activity detail view. */
export function getActivitySplits(activity: Activity, splitDistanceKm = 1): ActivityLap[] {
  const totalDistanceKm = validNumber(activity.distanceKm) ?? 0;
  const intervalKm = Math.max(0.1, validNumber(splitDistanceKm) ?? 1);
  const fallbackPace = totalDistanceKm > 0 ? activity.durationSec / totalDistanceKm : activity.paceSecPerKm;
  const streamSamples = activity.stream.filter((point) => validNumber(point.distanceKm) !== undefined);

  if (streamSamples.length > 1) {
    return splitSamples(streamSamples, totalDistanceKm, intervalKm, fallbackPace, activity.avgHr, activity.avgCadence);
  }

  if (activity.laps.length) {
    let distanceKm = 0;
    const lapSamples: SplitSample[] = [{ distanceKm: 0, heartRate: activity.avgHr, paceSecPerKm: fallbackPace, cadence: activity.avgCadence }];
    for (const lap of activity.laps) {
      distanceKm += Math.max(0, lap.distanceKm);
      lapSamples.push({ distanceKm, paceSecPerKm: lap.paceSecPerKm, heartRate: lap.avgHr, cadence: lap.avgCadence });
    }
    return splitSamples(lapSamples, totalDistanceKm, intervalKm, fallbackPace, activity.avgHr, activity.avgCadence);
  }

  return [{ lap: 1, distanceKm: Number(totalDistanceKm.toFixed(2)), durationSec: activity.durationSec, paceSecPerKm: fallbackPace, avgHr: activity.avgHr, avgCadence: activity.avgCadence }];
}
