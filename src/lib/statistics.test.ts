import { describe, expect, it } from "vitest";
import { monthlyStatistics, summarizeActivities, yearStatistics } from "./statistics";
import type { Activity } from "./types";

function activity(date: string, distanceKm: number, durationSec: number, avgHr?: number): Activity {
  return {
    id: date + distanceKm,
    personId: "me",
    date,
    startedAt: `${date}T06:00:00.000Z`,
    type: "easy",
    title: "Run",
    source: "manual",
    distanceKm,
    durationSec,
    paceSecPerKm: durationSec / distanceKm,
    avgHr,
    elevationGainM: 10,
    calories: 100,
    laps: [],
    stream: [],
  };
}

describe("statistics", () => {
  it("summarizes distance, time, pace, and weighted heart rate", () => {
    const result = summarizeActivities([activity("2026-09-01", 5, 1500, 140), activity("2026-09-02", 10, 3600, 160)]);
    expect(result).toMatchObject({ distanceKm: 15, sessions: 2, durationSec: 5100, paceSecPerKm: 340, avgHr: 154.11764705882354, elevationGainM: 20, calories: 200 });
  });

  it("creates twelve month buckets and a year total", () => {
    const activities = [activity("2026-01-04", 5, 1800), activity("2026-09-04", 10, 3600), activity("2025-09-04", 20, 7200)];
    expect(monthlyStatistics(activities, 2026)).toHaveLength(12);
    expect(monthlyStatistics(activities, 2026)[8]).toMatchObject({ month: "2026-09", distanceKm: 10, sessions: 1 });
    expect(yearStatistics(activities, 2026)).toMatchObject({ distanceKm: 15, sessions: 2, durationSec: 5400 });
  });
});
