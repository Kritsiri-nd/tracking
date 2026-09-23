export type RainForecast = {
  time: string;
  precipitationProbability: number;
  rainMm: number;
  showersMm: number;
  weatherCode: number;
  temperatureC: number;
};

type OpenMeteoResponse = {
  hourly?: {
    time?: string[];
    precipitation_probability?: number[];
    rain?: number[];
    showers?: number[];
    weather_code?: number[];
    temperature_2m?: number[];
  };
};

const BANGKOK = {
  latitude: 13.7563,
  longitude: 100.5018,
  timezone: "Asia/Bangkok",
};

function parseLocalTime(value: string) {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}:00+07:00`);
}

/** Fetch the next three local hourly rain snapshots for the default Bangkok view. */
export async function fetchRainForecast(signal?: AbortSignal): Promise<RainForecast[]> {
  const params = new URLSearchParams({
    latitude: String(BANGKOK.latitude),
    longitude: String(BANGKOK.longitude),
    hourly: "precipitation_probability,rain,showers,weather_code,temperature_2m",
    past_hours: "1",
    forecast_hours: "4",
    timezone: BANGKOK.timezone,
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Weather service is unavailable");
  const payload = await response.json() as OpenMeteoResponse;
  const hourly = payload.hourly;
  if (!hourly?.time?.length) throw new Error("No hourly weather data available");

  const now = Date.now() - 30 * 60 * 1000;
  return hourly.time.map((time, index) => ({
    time,
    precipitationProbability: hourly.precipitation_probability?.[index] ?? 0,
    rainMm: hourly.rain?.[index] ?? 0,
    showersMm: hourly.showers?.[index] ?? 0,
    weatherCode: hourly.weather_code?.[index] ?? 0,
    temperatureC: hourly.temperature_2m?.[index] ?? 0,
  })).filter((item) => parseLocalTime(item.time).getTime() >= now).slice(0, 3);
}

export function weatherLabel(code: number) {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorm";
}
