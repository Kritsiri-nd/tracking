import { describe, expect, it } from "vitest";
import { formatCadencePerSecond, formatDuration, formatPace, getActivitySplits, getWorkoutStatus, paceMinutesPerKm, percent } from "./progress";
import type { Activity, PlannedWorkout } from "./types";

const workout: PlannedWorkout = {
  id: "w-test",
  personId: "me",
  date: "2026-09-21",
  type: "easy",
  title: "Easy 5K",
  distanceKm: 5,
  status: "planned",
};

function activity(distanceKm: number): Activity {
  return {
    id: `a-${distanceKm}`,
    personId: "me",
    date: "2026-09-21",
    startedAt: "2026-09-21T06:00:00+07:00",
    type: "easy",
    title: "Test run",
    source: "manual",
    distanceKm,
    durationSec: 1800,
    paceSecPerKm: 360,
    laps: [],
    stream: [],
  };
}

describe("training progress", () => {
  it("classifies distance adherence around the 90–110% target window", () => {
    expect(getWorkoutStatus(workout, activity(4.6))).toBe("completed");
    expect(getWorkoutStatus(workout, activity(3))).toBe("partial");
    expect(getWorkoutStatus(workout, activity(5.6))).toBe("exceeded");
    expect(getWorkoutStatus(workout, activity(2))).toBe("missed");
  });

  it("keeps a workout planned until an activity is linked", () => {
    expect(getWorkoutStatus(workout)).toBe("planned");
    expect(getWorkoutStatus({ ...workout, status: "missed" })).toBe("missed");
  });

  it("formats pace and completion percentages", () => {
    expect(formatPace(371)).toBe("6:11");
    expect(formatDuration(191 * 60 + 35)).toBe("03:11");
    expect(formatDuration(36 * 60)).toBe("00:36");
    expect(formatCadencePerSecond(174)).toBe("2.9");
    expect(formatCadencePerSecond(undefined)).toBe("—");
    expect(paceMinutesPerKm(360)).toBe(6);
    expect(paceMinutesPerKm(49 * 60)).toBeUndefined();
    expect(percent(4.5, 5)).toBe(90);
  });

  it("builds complete custom splits from a sparse stream", () => {
    const run = { ...activity(10), durationSec: 2700, paceSecPerKm: 270, stream: [
      { distanceKm: 0, paceSecPerKm: 300, heartRate: 140, cadence: 170 },
      { distanceKm: 3, paceSecPerKm: 300, heartRate: 150, cadence: 172 },
      { distanceKm: 6, paceSecPerKm: 360, heartRate: 160, cadence: 176 },
      { distanceKm: 10, paceSecPerKm: 360, heartRate: 170, cadence: 178 },
    ] };
    const splits = getActivitySplits(run, 5);
    expect(splits).toHaveLength(2);
    expect(splits[0]).toMatchObject({ lap: 1, distanceKm: 5, durationSec: 1620, paceSecPerKm: 324, avgCadence: 174 });
    expect(splits[1]).toMatchObject({ lap: 2, distanceKm: 5, durationSec: 1800, paceSecPerKm: 360 });
  });

  it("falls back to FIT laps when the activity stream is unavailable", () => {
    const run = { ...activity(6), durationSec: 2160, paceSecPerKm: 360, laps: [1, 2, 3, 4, 5, 6].map((lap) => ({ lap, distanceKm: 1, durationSec: 360, paceSecPerKm: 360, avgHr: 145 })) };
    const splits = getActivitySplits(run, 5);
    expect(splits).toHaveLength(2);
    expect(splits[0]).toMatchObject({ distanceKm: 5, durationSec: 1800 });
    expect(splits[1]).toMatchObject({ distanceKm: 1, durationSec: 360 });
  });
});
