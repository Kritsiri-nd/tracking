import { describe, expect, it } from "vitest";
import { findMatchingWorkout, isDuplicateActivity, isRouteRepair } from "./import-logic";
import type { Activity, PlannedWorkout } from "./types";

const candidate: Activity = {
  id: "a-candidate",
  personId: "me",
  date: "2026-09-22",
  startedAt: "2026-09-22T06:00:00+07:00",
  type: "easy",
  title: "Morning run",
  source: "Suunto Race S",
  distanceKm: 5,
  durationSec: 1800,
  paceSecPerKm: 360,
  laps: [],
  stream: [],
};

function workout(overrides: Partial<PlannedWorkout>): PlannedWorkout {
  return {
    id: "w-default",
    personId: "me",
    date: "2026-09-22",
    type: "easy",
    title: "Easy run",
    distanceKm: 5,
    status: "planned",
    ...overrides,
  };
}

describe("import matching", () => {
  it("detects a near-identical run but keeps other users and materially different runs distinct", () => {
    expect(isDuplicateActivity(candidate, [{ ...candidate, id: "a-existing", distanceKm: 5.01, durationSec: 1803 }])).toBe(true);
    expect(isDuplicateActivity(candidate, [{ ...candidate, id: "a-partner", personId: "partner" }])).toBe(false);
    expect(isDuplicateActivity(candidate, [{ ...candidate, id: "a-longer", distanceKm: 5.1 }])).toBe(false);
  });

  it("matches the nearest unlinked plan for the same person and date", () => {
    const nearest = workout({ id: "w-nearest", distanceKm: 5.1 });
    const result = findMatchingWorkout(candidate, [
      workout({ id: "w-linked", activityId: "a-old", distanceKm: 5 }),
      workout({ id: "w-partner", personId: "partner", distanceKm: 5 }),
      workout({ id: "w-far", distanceKm: 10 }),
      nearest,
    ]);
    expect(result).toEqual(nearest);
  });

  it("returns undefined when no eligible plan exists", () => {
    expect(findMatchingWorkout(candidate, [workout({ date: "2026-09-23" })])).toBeUndefined();
  });

  it("recognizes a higher-resolution re-import as a route repair", () => {
    const existing = {
      ...candidate,
      id: "a-existing",
      importedFileName: "run.fit",
      track: Array.from({ length: 53 }, (_, index) => ({ latitude: 13 + index / 10000, longitude: 100 + index / 10000 })),
    };
    const repaired = {
      ...candidate,
      id: "a-new",
      importedFileName: "run.fit",
      track: Array.from({ length: 360 }, (_, index) => ({ latitude: 13 + index / 10000, longitude: 100 + index / 10000 })),
    };
    expect(isRouteRepair(repaired, existing)).toBe(true);
  });
});
