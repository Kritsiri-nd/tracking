import { getWorkoutStatus } from "./progress";
import type { Activity, LocalState, PlannedWorkout } from "./types";

export function isDuplicateActivity(candidate: Activity, activities: Activity[]) {
  return activities.some((activity) =>
    activity.personId === candidate.personId
    && activity.date === candidate.date
    && (!activity.startedAt || !candidate.startedAt || Math.abs(Date.parse(activity.startedAt) - Date.parse(candidate.startedAt)) < 60_000)
    && Math.abs(activity.distanceKm - candidate.distanceKm) < 0.02
    && Math.abs(activity.durationSec - candidate.durationSec) < 5,
  );
}

/** Allow the same FIT file to replace an older, lower-resolution route. */
export function isRouteRepair(candidate: Activity, existing: Activity) {
  const candidatePoints = candidate.track?.length ?? 0;
  const existingPoints = existing.track?.length ?? 0;
  return isDuplicateActivity(candidate, [existing])
    && Boolean(candidate.importedFileName)
    && candidate.importedFileName === existing.importedFileName
    && candidatePoints > Math.max(100, existingPoints * 2);
}

export function findMatchingWorkout(candidate: Activity, workouts: PlannedWorkout[]) {
  return workouts
    .filter((workout) => workout.personId === candidate.personId && workout.date === candidate.date && !workout.activityId && workout.type !== "rest" && workout.status !== "missed")
    .sort((left, right) => {
      const leftDifference = Math.abs((left.distanceKm ?? candidate.distanceKm) - candidate.distanceKm);
      const rightDifference = Math.abs((right.distanceKm ?? candidate.distanceKm) - candidate.distanceKm);
      return leftDifference - rightDifference;
    })[0];
}

/** Match and reserve plans as each file is committed, including files in the same batch. */
export function importActivities(state: LocalState, previews: Activity[]) {
  let activities = [...state.activities];
  let workouts = [...state.workouts];
  const imported: Activity[] = [];
  let skipped = 0;
  for (const preview of previews) {
    const existing = activities.find((activity) => isRouteRepair(preview, activity));
    if (existing) {
      const repaired = { ...preview, id: existing.id, title: existing.title, type: existing.type, shoeId: existing.shoeId, rpe: existing.rpe, note: existing.note };
      activities = activities.map((activity) => activity.id === existing.id ? repaired : activity);
      imported.push(repaired);
      continue;
    }
    if (isDuplicateActivity(preview, activities)) { skipped++; continue; }
    const match = findMatchingWorkout(preview, workouts);
    const activity = match ? { ...preview, type: match.type, title: match.title } : preview;
    activities.push(activity);
    imported.push(activity);
    if (match) workouts = workouts.map((workout) => workout.id === match.id ? { ...workout, activityId: activity.id, status: getWorkoutStatus(workout, activity) } : workout);
  }
  return { state: { ...state, activities, workouts }, imported, skipped };
}
