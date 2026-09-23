import { describe, expect, it } from "vitest";
import { activityFromParsedFit, cleanFitFileName, fitActivityTitle, parseFitFile, type ParsedFitPayload } from "./fit";

describe("FIT import", () => {
  it("cleans imported filenames for display", () => {
    expect(cleanFitFileName("morning_easy_run.fit")).toBe("Morning Easy Run");
    expect(cleanFitFileName("6a9cc09d2e9f6b234b72c016.fit")).toBe("Imported run");
    expect(cleanFitFileName("")).toBe("Imported run");
    expect(fitActivityTitle("6a9cc09d2e9f6b234b72c016.fit", "2026-09-05T21:54:52.000Z")).toBe("Run · Sep 6, 2026");
  });

  it("converts a parsed FIT summary into normalized activity units", () => {
    const parsed: ParsedFitPayload = {
      sessions: [{
        start_time: new Date("2026-09-20T18:30:00.000Z"),
        total_distance: 5.25,
        total_timer_time: 1800,
        avg_speed: 10.5,
        avg_heart_rate: 148,
        max_heart_rate: 169,
        total_ascent: 0.042,
        total_calories: 410,
      }],
      laps: [{ total_distance: 1, total_timer_time: 360, avg_heart_rate: 142, avg_cadence: 174 }],
      records: [{ distance: 1, enhanced_speed: 10, heart_rate: 144, position_lat: 13.7563, position_long: 100.5018, altitude: 12, timestamp: new Date("2026-09-20T18:31:00.000Z") }],
      device_infos: [{ product_name: "COROS PACE 4" }],
    };

    const activity = activityFromParsedFit(parsed, "partner", "morning.fit", "a-fixed");

    expect(activity).toMatchObject({
      id: "a-fixed",
      personId: "partner",
      date: "2026-09-21",
      title: "Morning",
      source: "COROS PACE 4",
      distanceKm: 5.25,
      durationSec: 1800,
      avgHr: 148,
      maxHr: 169,
      elevationGainM: 42,
      calories: 410,
    });
    expect(activity.paceSecPerKm).toBeCloseTo(342.857, 2);
    expect(activity.laps[0]).toMatchObject({ lap: 1, distanceKm: 1, durationSec: 360, paceSecPerKm: 360, avgHr: 142, avgCadence: 174 });
    expect(activity.stream[0]).toMatchObject({ distanceKm: 1, paceSecPerKm: 360, heartRate: 144 });
    expect(activity.track?.[0]).toMatchObject({ distanceKm: 1, latitude: 13.7563, longitude: 100.5018, elevationM: 12, timestamp: "2026-09-20T18:31:00.000Z" });
  });

  it("rejects parsed data without a valid workout summary", () => {
    expect(() => activityFromParsedFit({}, "me", "empty.fit")).toThrow("does not contain a workout session");
    expect(() => activityFromParsedFit({ sessions: [{ total_distance: 0, total_timer_time: 100 }] }, "me", "zero.fit")).toThrow("invalid distance or duration");
  });

  it("rejects corrupt binary data without a private fixture", async () => {
    const corruptFile = new File([new Uint8Array([0, 1, 2, 3, 4, 5])], "corrupt.fit");
    await expect(parseFitFile(corruptFile, "me")).rejects.toBeTruthy();
  });
});
