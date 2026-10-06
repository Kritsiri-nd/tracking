import { describe, expect, it } from "vitest";
import { findBestRunWindow, forecastColor, forecastScales, runAdvice } from "./weather-planning";
import type { WeatherReading } from "./weather";

const now = Date.parse("2026-10-03T17:30:00+07:00");
function reading(time: string, overrides: Partial<WeatherReading> = {}): WeatherReading {
  return { time: `2026-10-03T${time}`, precipitationProbability: 10, rainMm: 0, showersMm: 0, weatherCode: 0, temperatureC: 27, windKmh: 5, ...overrides };
}

describe("run window comparison", () => {
  it("uses all hourly intervals touched by a 90-minute run", () => {
    const readings = [reading("18:00"), reading("19:00", { precipitationProbability: 95, rainMm: 4 }), reading("20:00"), reading("21:00")];
    expect(findBestRunWindow(readings, 30, now)?.start).toBe(now);
    expect(findBestRunWindow(readings, 90, now)?.start).toBe(Date.parse("2026-10-03T19:00:00+07:00"));
  });
  it("does not use past precipitation as the next hour's forecast", () => {
    const result = findBestRunWindow([reading("17:00"), reading("18:00", { precipitationProbability: 80 }), reading("19:00")], 30, now);
    expect(result?.start).toBe(Date.parse("2026-10-03T18:00:00+07:00"));
  });
  it("rejects thunderstorms, very hot hours, and strong wind", () => {
    for (const overrides of [{ weatherCode: 95 }, { temperatureC: 35 }, { windKmh: 40 }]) {
      expect(findBestRunWindow([reading("18:00", overrides)], 30, now)).toBeUndefined();
      expect(runAdvice(reading("18:00", overrides))).not.toContain("Lower rain");
    }
  });
  it("prefers a cooler hour when rain chances are equal", () => {
    const result = findBestRunWindow([reading("18:00", { temperatureC: 33 }), reading("19:00")], 30, now);
    expect(result?.maxTemperatureC).toBe(27);
  });
  it("does not recommend partially covered runs or missing hourly intervals", () => {
    expect(findBestRunWindow([reading("18:00")], 90, now)).toBeUndefined();
    expect(findBestRunWindow([reading("18:00"), reading("20:00")], 90, now)).toBeUndefined();
    expect(findBestRunWindow([reading("18:00", { temperatureC: NaN })], 30, now)).toBeUndefined();
  });
  it("handles a run crossing midnight in Bangkok", () => {
    const midnightReadings = [{ ...reading("23:00"), time: "2026-10-04T00:00" }, { ...reading("23:00"), time: "2026-10-04T01:00" }];
    const start = Date.parse("2026-10-03T23:30:00+07:00");
    expect(findBestRunWindow(midnightReadings, 90, start)?.end).toBe(Date.parse("2026-10-04T01:00:00+07:00"));
  });
  it("uses the legend's rain-probability colors independently of rain amount", () => {
    const color = forecastColor("rain", reading("18:00", { precipitationProbability: 75, rainMm: 10 }));
    expect(color).toBe(forecastScales.rain[3].color);
  });
});
