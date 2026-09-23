export type RainForecast = {
  time: string;
  precipitationProbability: number;
  rainMm: number;
  showersMm: number;
  weatherCode: number;
  temperatureC: number;
};

export type WeatherReading = RainForecast & {
  windKmh: number;
};

export type WeatherGridPoint = {
  name: string;
  latitude: number;
  longitude: number;
  readings: WeatherReading[];
};

export type WeatherExplorerForecast = {
  locationName: string;
  latitude: number;
  longitude: number;
  hours: string[];
  points: WeatherGridPoint[];
};

export type RainViewerRadarFrame = {
  time: number;
  path: string;
};

export type RainViewerRadar = {
  generated: number;
  host: string;
  frames: RainViewerRadarFrame[];
};

type OpenMeteoResponse = {
  hourly?: {
    time?: string[];
    precipitation_probability?: number[];
    rain?: number[];
    showers?: number[];
    weather_code?: number[];
    temperature_2m?: number[];
    wind_speed_10m?: number[];
  };
};

type RainViewerResponse = {
  generated?: number;
  host?: string;
  radar?: {
    past?: RainViewerRadarFrame[];
    nowcast?: RainViewerRadarFrame[];
  };
};

const CHONBURI_REGION = {
  latitude: 13.22,
  longitude: 100.93,
  timezone: "Asia/Bangkok",
};

/** Named points keep the forecast focused on the Chonburi coast instead of a generic city center. */
const CHONBURI_LOCATIONS = [
  { name: "Bangsaen", latitude: 13.285, longitude: 100.925 },
  { name: "Chonburi", latitude: 13.361, longitude: 100.984 },
  { name: "Sriracha", latitude: 13.173, longitude: 100.931 },
  { name: "Laem Chabang", latitude: 13.082, longitude: 100.884 },
];

/** Fetch the latest observed radar frames for the map overlay. */
export async function fetchRainViewerRadar(signal?: AbortSignal): Promise<RainViewerRadar> {
  const response = await fetch("https://api.rainviewer.com/public/weather-maps.json", { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Radar service is unavailable");
  const payload = await response.json() as RainViewerResponse;
  const frames = [...(payload.radar?.past ?? []), ...(payload.radar?.nowcast ?? [])];
  if (!payload.host || !frames.length) throw new Error("No radar frames available");
  return {
    generated: payload.generated ?? Math.floor(Date.now() / 1000),
    host: payload.host,
    frames,
  };
}

function parseLocalTime(value: string) {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}:00+07:00`);
}

/** Fetch the next three local hourly rain snapshots for the Chonburi coast. */
export async function fetchRainForecast(signal?: AbortSignal): Promise<RainForecast[]> {
  const params = new URLSearchParams({
    latitude: String(CHONBURI_REGION.latitude),
    longitude: String(CHONBURI_REGION.longitude),
    hourly: "precipitation_probability,rain,showers,weather_code,temperature_2m",
    past_hours: "1",
    forecast_hours: "4",
    timezone: CHONBURI_REGION.timezone,
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

/** Fetch the next 12 hours for the four Chonburi-coast locations used by Weather Explorer. */
export async function fetchWeatherExplorerForecast(signal?: AbortSignal): Promise<WeatherExplorerForecast> {
  const params = new URLSearchParams({
    latitude: CHONBURI_LOCATIONS.map((point) => point.latitude.toFixed(4)).join(","),
    longitude: CHONBURI_LOCATIONS.map((point) => point.longitude.toFixed(4)).join(","),
    hourly: "precipitation_probability,rain,showers,weather_code,temperature_2m,wind_speed_10m",
    forecast_hours: "13",
    timezone: CHONBURI_REGION.timezone,
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Weather service is unavailable");
  const payload = await response.json() as OpenMeteoResponse | OpenMeteoResponse[];
  const responses = Array.isArray(payload) ? payload : [payload];
  const hours = responses[0]?.hourly?.time ?? [];
  if (!hours.length || !responses.length) throw new Error("No weather map data available");

  return {
    locationName: "Chonburi coast",
    latitude: CHONBURI_REGION.latitude,
    longitude: CHONBURI_REGION.longitude,
    hours,
    points: responses.map((item, pointIndex) => {
      const hourly = item.hourly;
      return {
        name: CHONBURI_LOCATIONS[pointIndex]?.name ?? "Chonburi",
        latitude: CHONBURI_LOCATIONS[pointIndex]?.latitude ?? CHONBURI_REGION.latitude,
        longitude: CHONBURI_LOCATIONS[pointIndex]?.longitude ?? CHONBURI_REGION.longitude,
        readings: hours.map((time, hourIndex) => ({
          time,
          precipitationProbability: hourly?.precipitation_probability?.[hourIndex] ?? 0,
          rainMm: hourly?.rain?.[hourIndex] ?? 0,
          showersMm: hourly?.showers?.[hourIndex] ?? 0,
          weatherCode: hourly?.weather_code?.[hourIndex] ?? 0,
          temperatureC: hourly?.temperature_2m?.[hourIndex] ?? 0,
          windKmh: hourly?.wind_speed_10m?.[hourIndex] ?? 0,
        })),
      };
    }),
  };
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
