import type { Activity, PlannedWorkout } from "./types";

export function isDuplicateActivity(candidate: Activity, activities: Activity[]) {
  return activities.some((activity) =>
    activity.personId === candidate.personId
    && activity.date === candidate.date
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
    .filter((workout) => workout.personId === candidate.personId && workout.date === candidate.date && !workout.activityId)
    .sort((left, right) => {
      const leftDifference = Math.abs((left.distanceKm ?? candidate.distanceKm) - candidate.distanceKm);
      const rightDifference = Math.abs((right.distanceKm ?? candidate.distanceKm) - candidate.distanceKm);
      return leftDifference - rightDifference;
    })[0];
}
