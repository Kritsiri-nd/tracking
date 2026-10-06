import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRainViewerRadar, fetchWeatherExplorerForecast, parseLocalTime } from "./weather";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function hourly() {
  return { time: ["2026-10-03T17:00", "2026-10-03T18:00", "2026-10-03T19:00"], precipitation_probability: [0, 10, 20], rain: [0, 0.1, 0.2], showers: [0, 0, 0], weather_code: [0, 1, 2], temperature_2m: [29, 28, 27], wind_speed_10m: [5, 6, 7] };
}

describe("weather provider data", () => {
  it("parses minute and second timestamps in Bangkok and preserves explicit offsets", () => {
    expect(parseLocalTime("2026-10-03T18:00").toISOString()).toBe("2026-10-03T11:00:00.000Z");
    expect(parseLocalTime("2026-10-03T18:00:00").toISOString()).toBe("2026-10-03T11:00:00.000Z");
    expect(parseLocalTime("2026-10-03T18:00Z").toISOString()).toBe("2026-10-03T18:00:00.000Z");
  });
  it("keeps future hourly data aligned and includes a custom running location", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-03T17:30:00+07:00"));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => Array.from({ length: 5 }, () => ({ hourly: hourly() })) });
    vi.stubGlobal("fetch", fetchMock);
    const forecast = await fetchWeatherExplorerForecast(undefined, { name: "My spot", latitude: 14, longitude: 101 });
    expect(forecast.hours).toEqual(["2026-10-03T18:00", "2026-10-03T19:00"]);
    expect(forecast.points[4].name).toBe("My spot");
    expect(forecast.points[4].readings[0].precipitationProbability).toBe(10);
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("latitude")).toContain("14.0000");
  });
  it("rejects null data instead of displaying missing values as dry weather", async () => {
    const data = Array.from({ length: 4 }, () => ({ hourly: hourly() }));
    (data[0].hourly.rain as unknown[])[1] = null;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    await expect(fetchWeatherExplorerForecast()).rejects.toThrow("Incomplete weather readings");
  });
  it("sorts observed radar frames and never uses future nowcast as observations", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ host: "https://tilecache.rainviewer.com", radar: { past: [{ time: 2, path: "/v2/radar/2" }, { time: 1, path: "/v2/radar/1" }], nowcast: [{ time: 3, path: "/v2/radar/3" }] } }) }));
    expect((await fetchRainViewerRadar()).frames.map((frame) => frame.time)).toEqual([1, 2]);
  });
  it("reports an error if only future radar frames are supplied", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ host: "https://tilecache.rainviewer.com", radar: { nowcast: [{ time: 3, path: "/v2/radar/3" }] } }) }));
    await expect(fetchRainViewerRadar()).rejects.toThrow("No radar frames");
  });
  it("aborts a provider that does not respond within 15 seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })));
    const request = fetchRainViewerRadar();
    const assertion = expect(request).rejects.toThrow("Aborted");
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });
});
