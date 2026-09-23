import type { Activity, PlannedWorkout } from "./types";

export function isDuplicateActivity(candidate: Activity, activities: Activity[]) {
  return activities.some((activity) =>
    activity.personId === candidate.personId
    && activity.date === candidate.date
    && Math.abs(activity.distanceKm - candidate.distanceKm) < 0.02
    && Math.abs(activity.durationSec - candidate.durationSec) < 5,
  );
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
