import { describe, expect, it } from "vitest";
import { activityToGpx, getActivityTrack } from "./gpx";
import type { Activity } from "./types";

const activity: Activity = {
  id: "a-gpx",
  personId: "me",
  date: "2026-09-22",
  startedAt: "2026-09-22T00:00:00.000Z",
  type: "easy",
  title: "Morning loop",
  source: "Suunto Race S",
  distanceKm: 2,
  durationSec: 720,
  paceSecPerKm: 360,
  laps: [],
  stream: [],
  track: [
    { distanceKm: 0, latitude: 13.7563, longitude: 100.5018, elevationM: 10, timestamp: "2026-09-22T00:00:00.000Z" },
    { distanceKm: 2, latitude: 13.757, longitude: 100.503, elevationM: 12, timestamp: "2026-09-22T00:12:00.000Z" },
  ],
};

describe("GPX export", () => {
  it("exports FIT track points as a GPX track", () => {
    const gpx = activityToGpx(activity);
    expect(gpx).toContain("<trk><name>Morning loop</name>");
    expect(gpx).toContain('lat="13.7563000" lon="100.5018000"');
    expect(gpx).toContain("<ele>10.0</ele>");
  });

  it("falls back to GPS points in the sampled stream", () => {
    const streamActivity = { ...activity, track: undefined, stream: [{ distanceKm: 0, latitude: 1, longitude: 2 }, { distanceKm: 1, latitude: 1.1, longitude: 2.1 }] };
    expect(getActivityTrack(streamActivity)).toHaveLength(2);
  });

  it("removes repeated start-position samples that create route spikes", () => {
    const noisyActivity = { ...activity, track: [
      { distanceKm: 0, latitude: 13.7563, longitude: 100.5018 },
      { distanceKm: 1, latitude: 13.759, longitude: 100.506 },
      { distanceKm: 2, latitude: 13.75631, longitude: 100.50181 },
      { distanceKm: 3, latitude: 13.758, longitude: 100.504 },
    ] };
    expect(getActivityTrack(noisyActivity)).toHaveLength(3);
  });
});
