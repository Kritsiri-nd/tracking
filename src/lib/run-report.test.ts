import { describe, expect, it } from "vitest";
import { createRunReportSvg, runReportSummary } from "./run-report";
import type { Activity } from "./types";

const activity: Activity = {
  id: "report-test",
  personId: "me",
  date: "2026-09-23",
  startedAt: "2026-09-23T18:15:00+07:00",
  type: "easy",
  title: "Evening & Easy",
  source: "Suunto Race S",
  distanceKm: 5.12,
  durationSec: 2520,
  paceSecPerKm: 492,
  avgHr: 138,
  maxHr: 165,
  avgCadence: 162,
  elevationGainM: 12,
  laps: [],
  stream: [],
};

describe("shareable run reports", () => {
  it("creates a useful text summary", () => {
    expect(runReportSummary(activity, "Wednesday, 23 September at 18:15")).toContain("5.12 km");
    expect(runReportSummary(activity, "Wednesday, 23 September at 18:15")).toContain("8:12/km");
  });

  it("escapes activity text in the report SVG", () => {
    const svg = createRunReportSvg(activity, "Wednesday, 23 September at 18:15");
    expect(svg).toContain("<svg");
    expect(svg).toContain("Evening &amp; Easy");
    expect(svg).not.toContain("<script");
  });
});
