import { describe, expect, it } from "vitest";
import { heartRateZones } from "./hr-zones";
import type { Activity } from "./types";

const activity: Activity = {
  id: "zone-test",
  personId: "me",
  date: "2026-09-23",
  startedAt: "2026-09-23T00:00:00.000Z",
  type: "easy",
  title: "Zone test",
  source: "manual",
  distanceKm: 5,
  durationSec: 300,
  paceSecPerKm: 60,
  maxHr: 190,
  laps: [],
  stream: [60, 120, 180, 240, 300].map((timestamp, index) => ({ distanceKm: index, heartRate: [100, 125, 145, 165, 180][index], timestamp: new Date(timestamp * 1000).toISOString() })),
};

describe("heartRateZones", () => {
  it("assigns samples to zones and keeps the total time", () => {
    const zones = heartRateZones(activity, 200);
    expect(zones.map((zone) => zone.durationSec)).toEqual([60, 60, 60, 60, 0]);
    expect(zones.map((zone) => zone.percentage)).toEqual([25, 25, 25, 25, 0]);
  });
});
