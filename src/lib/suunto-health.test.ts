import { describe, expect, it } from "vitest";
import { dailyHealthRows, healthApiPath, healthNumber, healthRange, healthTimestamp, normalizeHealthSamples, percentage, sleepDate, sleepHours } from "./suunto-health";

describe("Suunto health normalization", () => {
  it("keeps missing values separate from real zero and converts documented units", () => {
    expect(healthNumber(null)).toBeUndefined();
    expect(healthNumber("42")).toBeUndefined();
    expect(healthNumber(0)).toBe(0);
    expect(sleepHours(28800)).toBe(8);
    expect(sleepHours(-1)).toBeUndefined();
    expect(percentage(.98)).toBe(98);
    expect(percentage(98)).toBeUndefined();
  });
  it("interprets unsuffixed provider timestamps as UTC", () => {
    expect(healthTimestamp("2026-10-05T23:00:00.000")).toBe("2026-10-05T23:00:00.000Z");
    expect(healthTimestamp("10/05/2026")).toBeUndefined();
    expect(healthTimestamp("bad")).toBeUndefined();
  });
  it("updates repeated sleep IDs while preserving separate naps and empty IDs", () => {
    const entries = [
      { timestamp: "2026-10-05T21:00:00Z", entryData: { SleepId: "night", Duration: 25000 } },
      { timestamp: "2026-10-05T21:00:00Z", entryData: { SleepId: "night", Duration: 28800, BedtimeEnd: "2026-10-05T23:00:00Z" } },
      { timestamp: "2026-10-06T06:00:00Z", entryData: { SleepId: 0, IsNap: true, Duration: 1800 } },
      { timestamp: "2026-10-06T09:00:00Z", entryData: { SleepId: 0, IsNap: true, Duration: 600 } },
    ];
    const rows = normalizeHealthSamples("sleep", entries);
    expect(rows).toHaveLength(3);
    expect(rows[0].entry_data.Duration).toBe(28800);
    expect(sleepDate(rows[0])).toBe("2026-10-06");
    expect(rows[1].entry_data.IsNap).toBe(true);
  });
  it("does not combine totals from different devices or turn null into zero", () => {
    const rows = normalizeHealthSamples("daily", [
      { Name: "stepcount", Aggregation: "sum", Sources: [{ Name: "watch-a", Samples: [{ TimeISO8601: "2026-10-05T00:00:00.000", Value: 5000 }] }, { Name: "watch-b", Samples: [{ TimeISO8601: "2026-10-05T00:00:00.000", Value: 6000 }] }] },
      { Name: "energyconsumption", Aggregation: "sum", Sources: [{ Name: "watch-a", Samples: [{ TimeISO8601: "2026-10-05T00:00:00.000", Value: 418400 }, { TimeISO8601: "2026-10-06T00:00:00.000", Value: null }] }] },
    ]);
    expect(dailyHealthRows(rows, "watch-a")).toEqual([{ date: "2026-10-05", steps: 5000, kcal: 100 }, { date: "2026-10-06", kcal: undefined }]);
    expect(dailyHealthRows(rows, "watch-b")[0].steps).toBe(6000);
  });
  it("rejects malformed payloads before saving and strips unexpected fields", () => {
    expect(() => normalizeHealthSamples("sleep", {})).toThrow();
    expect(() => normalizeHealthSamples("activity", [{ timestamp: "invalid", entryData: {} }])).toThrow();
    const rows = normalizeHealthSamples("activity", [{ timestamp: "2026-10-06T00:00:00Z", entryData: { HR: 72, HRExt: { Min: 60, Max: 80 }, owner_id: "attacker", HRV: null } }]);
    expect(rows[0].entry_data).toEqual({ HR: 72, HRExt: { Min: 60, Max: 80 }, HRV: null });
  });
  it("prefers populated daily duplicates and accepts the documented numeric string", () => {
    const rows = normalizeHealthSamples("daily", [{ Name: "stepcount", Aggregation: "sum", Sources: [{ Name: "watch", Samples: [{ TimeISO8601: "2026-10-05T00:00:00Z", Value: "5000" }, { TimeISO8601: "2026-10-05T00:00:00Z", Value: null }] }] }]);
    expect(rows).toHaveLength(1);
    expect(dailyHealthRows(rows, "watch")[0].steps).toBe(5000);
  });
  it("enforces the 28-day limit and UTC endpoint formats", () => {
    const from = Date.parse("2026-09-09T17:00:00Z"), to = from + 28 * 86400000;
    expect(healthRange(String(from), String(to), to)).toEqual({ from, to });
    expect(() => healthRange(String(from), String(to + 1), to)).toThrow();
    expect(() => healthRange("", "NaN")).toThrow();
    expect(healthApiPath("sleep", from, to)).toBe(`/247samples/sleep?from=${from}&to=${to}`);
    expect(decodeURIComponent(healthApiPath("daily", from, to))).toContain("startdate=2026-09-09T17:00:00");
  });
});
