import { getBangkokDateKey } from "./date";

export const healthKinds = ["sleep", "daily", "activity", "recovery"] as const;
export type HealthKind = typeof healthKinds[number];
export type HealthSample = { kind: HealthKind; external_key: string; recorded_at: string; entry_data: Record<string, unknown> };
export type HealthSync = { kind: HealthKind; synced_at: string; range_from: string; range_to: string; sample_count: number };
export function healthNumber(value: unknown, min = 0, max = Infinity) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : undefined;
}
export function healthTimestamp(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.test(value)) return undefined;
  // Suunto daily statistics omit the UTC suffix even though their times are UTC.
  const qualified = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value) ? `${value}Z` : value;
  const time = Date.parse(qualified);
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}
export function healthRange(from: string, to: string, now = Date.now()) {
  const start = Number(from), end = Number(to);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start <= 0 || end <= start || end - start > 28 * 86400000 || end > now + 86400000) throw new Error("Choose a date range of 1 to 28 days.");
  return { from: start, to: end };
}
const allowedFields: Record<Exclude<HealthKind, "daily">, string[]> = {
  activity: ["HR", "StepCount", "EnergyConsumption", "SpO2", "Altitude", "HRExt", "HRV"],
  sleep: ["DeepSleepDuration", "LightSleepDuration", "REMSleepDuration", "Duration", "Feeling", "HRAvg", "HRMin", "SleepQualityScore", "BodyResourcesInsightId", "SleepId", "BedtimeStart", "BedtimeEnd", "MaxSpo2", "Altitude", "AvgHRV", "AvgHRVSampleCount", "IsNap", "SleepOnsetLatencyDuration", "WakeAfterSleepOnsetDuration", "WakeBeforeOffBedDuration", "DateTime"],
  recovery: ["Balance", "StressState"],
};
export function normalizeHealthSamples(kind: HealthKind, input: unknown): HealthSample[] {
  if (!Array.isArray(input) || input.length > 50000) throw new Error("Suunto returned an invalid health response.");
  const rows: HealthSample[] = [];
  if (kind === "daily") {
    for (const metric of input) {
      if (!metric || !["stepcount", "energyconsumption"].includes(metric.Name) || metric.Aggregation !== "sum" || !Array.isArray(metric.Sources)) continue;
      for (const source of metric.Sources) {
        if (typeof source.Name !== "string" || source.Name.length > 200 || !Array.isArray(source.Samples)) continue;
        for (const sample of source.Samples) {
          const time = healthTimestamp(sample?.TimeISO8601);
          if (!time) throw new Error("Suunto returned an invalid daily timestamp.");
          const value = typeof sample.Value === "string" && /^\d+(\.\d+)?$/.test(sample.Value) ? Number(sample.Value) : sample.Value;
          rows.push({ kind, recorded_at: time, external_key: `${metric.Name}:${source.Name}:${time}`, entry_data: { metric: metric.Name, source: source.Name, value: healthNumber(value) ?? null } });
        }
      }
    }
  } else {
    for (const sample of input) {
      const time = healthTimestamp(sample?.timestamp);
      if (!time || !sample.entryData || typeof sample.entryData !== "object" || Array.isArray(sample.entryData)) throw new Error("Suunto returned an invalid health sample.");
      const data: Record<string, unknown> = {};
      for (const field of allowedFields[kind]) {
        const value = sample.entryData[field];
        if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)) || (typeof value === "string" && value.length < 200)) data[field] = value;
        if (field === "HRExt" && value && typeof value === "object") data[field] = { Min: healthNumber(value.Min) ?? null, Max: healthNumber(value.Max) ?? null };
      }
      const id = kind === "sleep" && data.SleepId && (typeof data.SleepId === "number" || typeof data.SleepId === "string") ? String(data.SleepId) : time;
      rows.push({ kind, recorded_at: time, external_key: id, entry_data: data });
    }
  }
  if (rows.length > 50000) throw new Error("Health response is too large.");
  const unique = new Map<string, HealthSample>();
  for (const row of rows) {
    // Daily API can return both a null and a populated record for the same day.
    if (kind === "daily" && row.entry_data.value === null && unique.get(row.external_key)?.entry_data.value != null) continue;
    unique.set(row.external_key, row);
  }
  return [...unique.values()];
}
export function healthApiPath(kind: HealthKind, from: number, to: number) {
  if (kind === "daily") return `/247samples/daily-activity-statistics?${new URLSearchParams({ startdate: new Date(from).toISOString().slice(0, 19), enddate: new Date(to).toISOString().slice(0, 19) })}`;
  return `/247samples/${kind}?from=${from}&to=${to}`;
}
export function sleepDate(sample: HealthSample) {
  return getBangkokDateKey(new Date(healthTimestamp(sample.entry_data.BedtimeEnd) ?? sample.recorded_at));
}
export function sleepHours(value: unknown) {
  const seconds = healthNumber(value, 0, 172800);
  return seconds === undefined ? undefined : seconds / 3600;
}
export function percentage(value: unknown) {
  const ratio = healthNumber(value, 0, 1);
  return ratio === undefined ? undefined : ratio * 100;
}
export function dailyHealthRows(samples: HealthSample[], source: string) {
  const days = new Map<string, { date: string; steps?: number; kcal?: number }>();
  for (const sample of samples) {
    if (sample.kind !== "daily" || sample.entry_data.source !== source) continue;
    const date = getBangkokDateKey(new Date(sample.recorded_at));
    const row = days.get(date) ?? { date };
    const value = healthNumber(sample.entry_data.value);
    if (sample.entry_data.metric === "stepcount" && (value !== undefined || row.steps === undefined)) row.steps = value;
    if (sample.entry_data.metric === "energyconsumption" && (value !== undefined || row.kcal === undefined)) row.kcal = value === undefined ? undefined : value / 4184;
    days.set(date, row);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
