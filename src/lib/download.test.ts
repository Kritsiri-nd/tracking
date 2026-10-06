import { describe, expect, it } from "vitest";
import { activitiesToCsv } from "./download";
import type { Activity } from "./types";

describe("activity CSV export", () => {
  it("preserves Thai text, escapes notes, and prevents formulas in spreadsheet cells", () => {
    const activity: Activity = { id: "run", personId: "me", date: "2026-10-03", startedAt: "2026-10-03T06:00:00+07:00", title: "วิ่งเช้า", type: "easy", source: "manual", distanceKm: 5, durationSec: 1800, paceSecPerKm: 360, laps: [], stream: [], note: '=HYPERLINK("example")\nsecond line' };
    const csv = activitiesToCsv([activity]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"วิ่งเช้า"');
    expect(csv).toContain('"\'=HYPERLINK(""example"")\nsecond line"');
    expect(csv).toContain('"5","1800","360"');
  });
});
