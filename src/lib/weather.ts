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
  fetchedAt: number;
  locationName: string;
  latitude: number;
  longitude: number;
  hours: string[];
  points: WeatherGridPoint[];
};

export type WeatherLocation = { name: string; latitude: number; longitude: number };

export type RainViewerRadarFrame = {
  time: number;
  path: string;
};

export type RainViewerRadar = {
  generated: number;
  host: string;
  pastFrames: RainViewerRadarFrame[];
  nowcastFrames: RainViewerRadarFrame[];
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

/** Bound both the response and JSON download so failed providers do not leave the UI loading forever. */
async function fetchWeatherPayload<T>(url: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 15_000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error("Weather service is unavailable");
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

/** Named points keep the forecast focused on the Chonburi coast instead of a generic city center. */
export const CHONBURI_LOCATIONS: WeatherLocation[] = [
  { name: "Bangsaen", latitude: 13.285, longitude: 100.925 },
  { name: "Chonburi", latitude: 13.361, longitude: 100.984 },
  { name: "Sriracha", latitude: 13.173, longitude: 100.931 },
  { name: "Laem Chabang", latitude: 13.082, longitude: 100.884 },
];

/** Fetch the latest observed radar frames for the map overlay. */
export async function fetchRainViewerRadar(signal?: AbortSignal): Promise<RainViewerRadar> {
  const payload = await fetchWeatherPayload<RainViewerResponse>("https://api.rainviewer.com/public/weather-maps.json", signal);
  const pastFrames = (payload.radar?.past ?? []).filter((frame) => Number.isFinite(frame.time) && typeof frame.path === "string" && frame.path.startsWith("/v2/radar/")).sort((a, b) => a.time - b.time);
  const nowcastFrames: RainViewerRadarFrame[] = [];
  const frames = pastFrames;
  if (!payload.host || !frames.length) throw new Error("No radar frames available");
  return {
    generated: payload.generated ?? Math.floor(Date.now() / 1000),
    host: payload.host,
    pastFrames,
    nowcastFrames,
    frames,
  };
}

export function parseLocalTime(value: string) {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}+07:00`);
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
export async function fetchWeatherExplorerForecast(signal?: AbortSignal, customLocation?: WeatherLocation): Promise<WeatherExplorerForecast> {
  const locations = customLocation ? [...CHONBURI_LOCATIONS, customLocation] : CHONBURI_LOCATIONS;
  const params = new URLSearchParams({
    latitude: locations.map((point) => point.latitude.toFixed(4)).join(","),
    longitude: locations.map((point) => point.longitude.toFixed(4)).join(","),
    hourly: "precipitation_probability,rain,showers,weather_code,temperature_2m,wind_speed_10m",
    forecast_hours: "15",
    timezone: CHONBURI_REGION.timezone,
  });
  const payload = await fetchWeatherPayload<OpenMeteoResponse | OpenMeteoResponse[]>(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, signal);
  const responses = Array.isArray(payload) ? payload : [payload];
  const hours = responses[0]?.hourly?.time ?? [];
  if (!hours.length || !responses.length) throw new Error("No weather map data available");
  if (responses.length !== locations.length) throw new Error("Incomplete location forecasts");
  for (const item of responses) {
    const hourly = item.hourly;
    if (!hourly?.time || hourly.time.length !== hours.length || hourly.time.some((time, index) => time !== hours[index])) throw new Error("Forecast times do not match");
    for (const values of [hourly.precipitation_probability, hourly.rain, hourly.showers, hourly.weather_code, hourly.temperature_2m, hourly.wind_speed_10m]) {
      if (!values || values.length !== hours.length || values.some((value) => typeof value !== "number" || !Number.isFinite(value))) throw new Error("Incomplete weather readings. Please try again.");
    }
  }

  const futureHours = hours.filter((time) => parseLocalTime(time).getTime() > Date.now()).slice(0, 12);
  if (!futureHours.length) throw new Error("Forecast has no upcoming hours");
  return {
    fetchedAt: Date.now(),
    locationName: customLocation?.name ?? "Chonburi coast",
    latitude: customLocation?.latitude ?? CHONBURI_REGION.latitude,
    longitude: customLocation?.longitude ?? CHONBURI_REGION.longitude,
    hours: futureHours,
    points: responses.map((item, pointIndex) => {
      const hourly = item.hourly;
      return {
        name: locations[pointIndex].name,
        latitude: locations[pointIndex].latitude,
        longitude: locations[pointIndex].longitude,
        readings: futureHours.map((time) => {
          const hourIndex = hours.indexOf(time);
          return ({
          time,
          precipitationProbability: hourly?.precipitation_probability?.[hourIndex] ?? 0,
          rainMm: hourly?.rain?.[hourIndex] ?? 0,
          showersMm: hourly?.showers?.[hourIndex] ?? 0,
          weatherCode: hourly?.weather_code?.[hourIndex] ?? 0,
          temperatureC: hourly?.temperature_2m?.[hourIndex] ?? 0,
          windKmh: hourly?.wind_speed_10m?.[hourIndex] ?? 0,
          });
        }),
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
