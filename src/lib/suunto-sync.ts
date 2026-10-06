import type { Activity } from "./types";

export type SuuntoWorkout = { workoutKey: string; workoutName?: string; startTime?: number; totalDistance?: number };
export type SuuntoSyncResult = { saved: number; skipped: number; failed: string[] };

/** Process every page sequentially, retaining each successful save if a later call fails. */
export async function syncSuuntoWorkouts(options: {
  list: (offset: number) => Promise<{ workouts: SuuntoWorkout[]; nextOffset: number | null }>;
  download: (workout: SuuntoWorkout) => Promise<Activity>;
  save: (activity: Activity) => Promise<boolean>;
  alreadySaved: (key: string) => boolean;
  wait: () => Promise<void>;
  progress: (result: SuuntoSyncResult) => void;
  signal: AbortSignal;
}) {
  const result: SuuntoSyncResult = { saved: 0, skipped: 0, failed: [] };
  const seen = new Set<string>();
  let offset: number | null = 0;
  while (offset !== null) {
    options.signal.throwIfAborted();
    const page = await options.list(offset);
    for (const workout of page.workouts) {
      options.signal.throwIfAborted();
      if (seen.has(workout.workoutKey)) continue;
      seen.add(workout.workoutKey);
      if (options.alreadySaved(workout.workoutKey)) {
        result.skipped++;
      } else {
        await options.wait();
        try {
          const activity = await options.download(workout);
          options.signal.throwIfAborted();
          if (await options.save(activity)) result.saved++;
          else result.skipped++;
        } catch (error) {
          if (options.signal.aborted || (error && typeof error === "object" && "status" in error && [401, 429, 503].includes(Number(error.status)))) throw error;
          result.failed.push(`${workout.workoutName || workout.workoutKey}: ${error instanceof Error ? error.message : "Import failed"}`);
        }
      }
      options.progress({ ...result, failed: [...result.failed] });
    }
    if (page.nextOffset !== null && page.nextOffset <= offset) throw new Error("Suunto returned an invalid page. Please try again.");
    offset = page.nextOffset;
    if (offset !== null) await options.wait();
  }
  return result;
}
