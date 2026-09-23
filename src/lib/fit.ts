import FitParser from "fit-file-parser";
import type { Activity, ActivityLap, ActivityPoint, ActivityTrackPoint, PersonId, WorkoutType } from "./types";

export type ParsedFitPayload = {
  sessions?: Array<Record<string, unknown>>;
  laps?: Array<Record<string, unknown>>;
  records?: Array<Record<string, unknown>>;
  device_infos?: Array<Record<string, unknown>>;
};

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function integerValue(value: unknown) {
  const number = numberValue(value);
  return number === undefined ? undefined : Math.round(number);
}

function dateValue(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function optionalDateValue(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  return undefined;
}

function getPace(speed: number | undefined) {
  return speed && speed > 0 ? 3600 / speed : undefined;
}

/** Turn device-generated FIT filenames into readable activity labels. */
export function cleanFitFileName(fileName?: string) {
  const baseName = (fileName ?? "").split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") ?? "";
  const readable = baseName.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const compactName = readable.replace(/\s/g, "");
  if (!readable || /^[a-f0-9]{16,}$/i.test(compactName)) return "Imported run";
  return readable.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

/** Use the FIT filename when it is meaningful, otherwise create a dated run title. */
export function fitActivityTitle(fileName?: string, startedAt?: string) {
  const fileTitle = cleanFitFileName(fileName);
  if (fileTitle !== "Imported run" || !startedAt) return fileTitle;
  const date = new Date(startedAt);
  if (Number.isNaN(date.valueOf())) return fileTitle;
  const readableDate = new Intl.DateTimeFormat("en", { timeZone: "Asia/Bangkok", month: "short", day: "numeric", year: "numeric" }).format(date);
  return `Run · ${readableDate}`;
}

function bangkokDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoDate));
}

export function activityFromParsedFit(
  parsed: ParsedFitPayload,
  personId: PersonId,
  fileName: string,
  activityId = `a-${Date.now()}`,
): Activity {
  const session = parsed.sessions?.[0];
  if (!session) throw new Error("This FIT file does not contain a workout session.");
  const startedAt = dateValue(session.start_time ?? session.timestamp);
  const distanceKm = numberValue(session.total_distance) ?? 0;
  const durationSec = Math.round(numberValue(session.total_timer_time) ?? numberValue(session.total_elapsed_time) ?? 0);
  if (distanceKm <= 0 || durationSec <= 0) throw new Error("This FIT workout has an invalid distance or duration.");
  const avgSpeed = numberValue(session.avg_speed);
  const sessionPace = getPace(avgSpeed);
  const recordPoints = (parsed.records ?? []).filter((record) => numberValue(record.distance) !== undefined || (numberValue(record.position_lat) !== undefined && numberValue(record.position_long) !== undefined));
  const track: ActivityTrackPoint[] = recordPoints.flatMap((record) => {
    const latitude = numberValue(record.position_lat);
    const longitude = numberValue(record.position_long);
    if (latitude === undefined || longitude === undefined) return [];
    return [{
      distanceKm: numberValue(record.distance),
      latitude,
      longitude,
      elevationM: numberValue(record.altitude) ?? numberValue(record.enhanced_altitude),
      timestamp: optionalDateValue(record.timestamp),
    }];
  });
  const stream: ActivityPoint[] = recordPoints.filter((_, index) => index % Math.max(1, Math.ceil(recordPoints.length / 80)) === 0).map((record) => ({
    distanceKm: numberValue(record.distance) ?? 0,
    paceSecPerKm: getPace(numberValue(record.enhanced_speed) ?? numberValue(record.speed)),
    heartRate: integerValue(record.heart_rate),
    latitude: numberValue(record.position_lat),
    longitude: numberValue(record.position_long),
    elevationM: numberValue(record.altitude) ?? numberValue(record.enhanced_altitude),
    cadence: integerValue(record.cadence) ?? integerValue(record.enhanced_cadence),
    temperatureC: numberValue(record.temperature),
    timestamp: optionalDateValue(record.timestamp),
  }));
  const laps: ActivityLap[] = (parsed.laps ?? []).map((lap, index) => {
    const lapDistance = numberValue(lap.total_distance) ?? 0;
    const lapDuration = Math.round(numberValue(lap.total_timer_time) ?? numberValue(lap.total_elapsed_time) ?? 0);
    return { lap: index + 1, distanceKm: lapDistance, durationSec: lapDuration, paceSecPerKm: lapDistance ? lapDuration / lapDistance : undefined, avgHr: integerValue(lap.avg_heart_rate), avgCadence: numberValue(lap.avg_cadence) ?? numberValue(lap.enhanced_avg_cadence) };
  });
  const device = parsed.device_infos?.[0];
  const deviceName = typeof device?.product_name === "string" ? device.product_name : "Suunto Race S";
  return {
    id: activityId,
    personId,
    date: bangkokDate(startedAt),
    startedAt,
    type: "easy" as WorkoutType,
    title: fitActivityTitle(fileName, startedAt),
    source: deviceName.toLowerCase().includes("coros") ? "COROS PACE 4" : "Suunto Race S",
    distanceKm,
    durationSec,
    paceSecPerKm: sessionPace ?? (distanceKm ? durationSec / distanceKm : 0),
    avgHr: integerValue(session.avg_heart_rate),
    maxHr: integerValue(session.max_heart_rate),
    avgCadence: numberValue(session.avg_cadence),
    elevationGainM: (numberValue(session.total_ascent) ?? 0) * 1000,
    calories: integerValue(session.total_calories),
    laps,
    stream,
    track,
    importedFileName: fileName,
  };
}

export async function parseFitFile(file: File, personId: PersonId): Promise<Activity> {
  const buffer = await file.arrayBuffer();
  const parser = new FitParser({ mode: "list", speedUnit: "km/h", lengthUnit: "km", elapsedRecordField: true });
  const parsed = (await parser.parseAsync(buffer)) as ParsedFitPayload;
  return activityFromParsedFit(parsed, personId, file.name);
}
