import { parseLocalTime, type WeatherReading } from "./weather";

export type WeatherLayer = "rain" | "temperature" | "wind";
export type WeatherMode = "radar" | "forecast";

export const forecastScales: Record<WeatherLayer, Array<{ color: string; label: string; min: number }>> = {
  rain: [{ color: "#94a394", label: "<15%", min: 0 }, { color: "#77c77d", label: "15–39%", min: 15 }, { color: "#f5a623", label: "40–69%", min: 40 }, { color: "#f15b78", label: "70–89%", min: 70 }, { color: "#a855f7", label: "≥90%", min: 90 }],
  temperature: [{ color: "#70b7d9", label: "<28°C", min: -100 }, { color: "#f0cf67", label: "28–30°C", min: 28 }, { color: "#f4a340", label: "31–33°C", min: 31 }, { color: "#ed5d62", label: "≥34°C", min: 34 }],
  wind: [{ color: "#94a394", label: "<10 km/h", min: 0 }, { color: "#70b7d9", label: "10–19", min: 10 }, { color: "#f5a623", label: "20–29", min: 20 }, { color: "#a855f7", label: "≥30", min: 30 }],
};

export function forecastColor(layer: WeatherLayer, reading: WeatherReading) {
  const value = layer === "rain" ? reading.precipitationProbability : layer === "temperature" ? reading.temperatureC : reading.windKmh;
  return forecastScales[layer].findLast((item) => value >= item.min)?.color ?? "#94a394";
}

export function rainAmount(reading: WeatherReading) { return reading.rainMm + reading.showersMm; }

export function runAdvice(reading: WeatherReading) {
  if (reading.weatherCode >= 95) return "Thunderstorms forecast — consider an indoor session";
  if (reading.temperatureC >= 35) return "Very hot — consider a cooler time";
  if (reading.windKmh >= 40) return "Strong winds — consider another time";
  if (reading.precipitationProbability >= 65 || rainAmount(reading) >= 1) return "Rain likely during this hour";
  if (reading.temperatureC >= 31) return "Warm conditions — compare cooler hours";
  if (reading.windKmh >= 30) return "Windy conditions";
  if (reading.precipitationProbability >= 35) return "Some chance of rain";
  return "Lower rain chance in this forecast";
}

export type RunWindow = { start: number; end: number; maxRainProbability: number; maxTemperatureC: number; maxWindKmh: number; score: number };

/** Precipitation at timestamp T covers the preceding hour; require coverage of the entire run. */
export function findBestRunWindow(readings: WeatherReading[], durationMin: number, now = Date.now()): RunWindow | undefined {
  if (durationMin <= 0 || !Number.isFinite(durationMin) || !Number.isFinite(now)) return undefined;
  const hour = 3_600_000;
  const starts = [now, ...readings.map((reading) => parseLocalTime(reading.time).getTime()).filter((time) => time > now && time <= now + 6 * hour)];
  const candidates: RunWindow[] = [];
  for (const start of starts) {
    const end = start + durationMin * 60_000;
    const relevant = readings.filter((reading) => {
      const time = parseLocalTime(reading.time).getTime();
      return time > start && time - hour < end;
    }).sort((a, b) => parseLocalTime(a.time).getTime() - parseLocalTime(b.time).getTime());
    let coveredUntil = start;
    let invalid = false;
    for (const reading of relevant) {
      const time = parseLocalTime(reading.time).getTime();
      if (time - hour > coveredUntil || [reading.precipitationProbability, reading.temperatureC, reading.windKmh, reading.weatherCode, reading.rainMm, reading.showersMm].some((value) => !Number.isFinite(value)) || reading.weatherCode >= 95 || reading.temperatureC >= 35 || reading.windKmh >= 40) { invalid = true; break; }
      coveredUntil = time;
    }
    if (invalid || coveredUntil < end || !relevant.length) continue;
    const maxRainProbability = Math.max(...relevant.map((reading) => reading.precipitationProbability));
    const maxTemperatureC = Math.max(...relevant.map((reading) => reading.temperatureC));
    const maxWindKmh = Math.max(...relevant.map((reading) => reading.windKmh));
    const score = maxRainProbability + Math.max(...relevant.map(rainAmount)) * 20 + Math.max(0, maxTemperatureC - 28) * 8 + Math.max(0, maxWindKmh - 15) * 2;
    candidates.push({ start, end, maxRainProbability, maxTemperatureC, maxWindKmh, score });
  }
  return candidates.sort((a, b) => a.score - b.score || a.start - b.start)[0];
}
