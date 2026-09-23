import type { SupabaseClient } from "@supabase/supabase-js";
import { fitActivityTitle } from "./fit";
import { getActivityTrack, sampleActivityTrack } from "./gpx";
import { SUPABASE_SHOE_BUCKET, supabase } from "./supabase";
import type { Activity, ActivityLap, ActivityPoint, LocalState, MonthlyGoal, PlannedWorkout, Shoe, WorkoutStatus, WorkoutType } from "./types";

type AnyRow = Record<string, unknown>;

const workoutTypes: WorkoutType[] = ["easy", "long", "tempo", "interval", "recovery", "race", "rest"];
const workoutStatuses: WorkoutStatus[] = ["planned", "completed", "partial", "exceeded", "missed"];

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function workoutType(value: unknown): WorkoutType {
  return typeof value === "string" && workoutTypes.includes(value as WorkoutType) ? value as WorkoutType : "easy";
}

function workoutStatus(value: unknown): WorkoutStatus {
  return typeof value === "string" && workoutStatuses.includes(value as WorkoutStatus) ? value as WorkoutStatus : "planned";
}

function dateValue(value: unknown, fallback: string) {
  return typeof value === "string" && value ? value.slice(0, 10) : fallback;
}

function rowError(label: string, error: { message: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

function dbPace(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 60) : null;
}

function appPace(value: unknown) {
  const seconds = asOptionalNumber(value);
  return seconds === undefined ? undefined : Number((seconds / 60).toFixed(2));
}

function dbActivitySource(activity: Activity) {
  if (activity.source === "manual") return "manual";
  if (activity.importedFileName?.toLowerCase().endsWith(".fit")) return "fit";
  return "other";
}

function mapShoe(row: AnyRow): Shoe {
  return {
    id: asString(row.id),
    personId: "me",
    name: asString(row.name, "Running shoe"),
    brand: asString(row.brand) || undefined,
    model: asString(row.model) || undefined,
    maxDistanceKm: asNumber(row.max_distance_km, 800),
    retired: Boolean(row.retired),
    imagePath: asString(row.image_storage_path) || undefined,
    imageUrl: asString(row.image_url) || undefined,
  };
}

function mapWorkout(row: AnyRow): PlannedWorkout {
  const date = dateValue(row.scheduled_date, new Date().toISOString().slice(0, 10));
  return {
    id: asString(row.id),
    personId: "me",
    date,
    type: workoutType(row.type),
    title: asString(row.title, "Run"),
    distanceKm: asOptionalNumber(row.target_distance_km),
    durationMin: typeof row.target_duration_sec === "number" ? Math.round(row.target_duration_sec / 60) : undefined,
    paceMin: appPace(row.pace_min_sec_per_km),
    paceMax: appPace(row.pace_max_sec_per_km),
    note: asString(row.notes) || undefined,
    status: workoutStatus(row.status),
    postponedFrom: dateValue(row.postponed_from, "") || undefined,
  };
}

function mapActivity(row: AnyRow, lapRows: AnyRow[], pointRows: AnyRow[]): Activity {
  const date = dateValue(row.activity_date, new Date().toISOString().slice(0, 10));
  const importedFileName = asString(row.imported_file_name) || undefined;
  const startedAt = asString(row.started_at, `${date}T00:00:00.000Z`);
  const storedTitle = asString(row.title);
  const needsGeneratedTitle = storedTitle === "Imported run" || /^[a-f0-9]{16,}$/i.test(storedTitle);
  const title = needsGeneratedTitle ? fitActivityTitle(importedFileName, startedAt) : storedTitle || "Run";
  const points = pointRows.filter((point) => point.activity_id === row.id).sort((a, b) => asNumber(a.point_index) - asNumber(b.point_index));
  const laps = lapRows.filter((lap) => lap.activity_id === row.id).sort((a, b) => asNumber(a.lap_number) - asNumber(b.lap_number));
  const stream: ActivityPoint[] = points.map((point) => ({
    distanceKm: asNumber(point.distance_km),
    paceSecPerKm: asOptionalNumber(point.pace_sec_per_km),
    heartRate: asOptionalNumber(point.heart_rate),
    latitude: asOptionalNumber(point.latitude),
    longitude: asOptionalNumber(point.longitude),
    elevationM: asOptionalNumber(point.elevation_m),
    cadence: asOptionalNumber(point.cadence),
    temperatureC: asOptionalNumber(point.temperature_c),
    timestamp: asString(point.recorded_at) || undefined,
  }));
  const track = points.filter((point) => typeof point.latitude === "number" && typeof point.longitude === "number").map((point) => ({
    distanceKm: asOptionalNumber(point.distance_km),
    latitude: asNumber(point.latitude),
    longitude: asNumber(point.longitude),
    elevationM: asOptionalNumber(point.elevation_m),
    timestamp: asString(point.recorded_at) || undefined,
  }));
  return {
    id: asString(row.id),
    personId: "me",
    date,
    startedAt,
    type: workoutType(row.type),
    title,
    source: row.source === "manual" ? "manual" : "Suunto Race S",
    distanceKm: asNumber(row.distance_km),
    durationSec: asNumber(row.duration_sec),
    paceSecPerKm: asNumber(row.pace_sec_per_km),
    avgHr: asOptionalNumber(row.avg_heart_rate),
    maxHr: asOptionalNumber(row.max_heart_rate),
    avgCadence: asOptionalNumber(row.avg_cadence),
    elevationGainM: asOptionalNumber(row.elevation_gain_m),
    calories: asOptionalNumber(row.calories),
    laps: laps.map((lap) => ({
      lap: asNumber(lap.lap_number),
      distanceKm: asNumber(lap.distance_km),
      durationSec: asNumber(lap.duration_sec),
      paceSecPerKm: asOptionalNumber(lap.pace_sec_per_km),
      avgHr: asOptionalNumber(lap.avg_heart_rate),
    })),
    stream,
    track: track.length ? track : undefined,
    importedFileName,
    shoeId: asString(row.shoe_id) || undefined,
    rpe: asOptionalNumber(row.rpe),
    note: asString(row.note) || undefined,
  };
}

function mapGoal(row: AnyRow): MonthlyGoal {
  return {
    id: asString(row.id),
    personId: "me",
    month: dateValue(row.month_start, new Date().toISOString().slice(0, 7)).slice(0, 7),
    targetDistanceKm: asOptionalNumber(row.target_distance_km),
    targetSessions: asOptionalNumber(row.target_sessions),
  };
}

/** Load every user-facing collection in parallel and map database rows to app models. */
export async function loadCloudState(fallback: LocalState, ownerId?: string) {
  if (!supabase) return { state: fallback, hasCloudData: false };
  const workoutsQuery = ownerId ? supabase.from("planned_workouts").select("*").eq("owner_id", ownerId) : supabase.from("planned_workouts").select("*");
  const activitiesQuery = ownerId ? supabase.from("activities").select("*").eq("owner_id", ownerId) : supabase.from("activities").select("*");
  const lapsQuery = ownerId ? supabase.from("activity_laps").select("*").eq("owner_id", ownerId) : supabase.from("activity_laps").select("*");
  const pointsQuery = ownerId ? supabase.from("activity_points").select("*").eq("owner_id", ownerId) : supabase.from("activity_points").select("*");
  const shoesQuery = ownerId ? supabase.from("shoes").select("*").eq("owner_id", ownerId) : supabase.from("shoes").select("*");
  const goalsQuery = ownerId ? supabase.from("monthly_goals").select("*").eq("owner_id", ownerId) : supabase.from("monthly_goals").select("*");
  const [workoutsResult, activitiesResult, lapsResult, pointsResult, shoesResult, goalsResult] = await Promise.all([
    workoutsQuery,
    activitiesQuery,
    lapsQuery,
    pointsQuery,
    shoesQuery,
    goalsQuery,
  ]);
  rowError("Loading plans", workoutsResult.error);
  rowError("Loading activities", activitiesResult.error);
  rowError("Loading laps", lapsResult.error);
  rowError("Loading GPS points", pointsResult.error);
  rowError("Loading shoes", shoesResult.error);
  rowError("Loading monthly goals", goalsResult.error);
  const workouts = (workoutsResult.data ?? []).map((row) => mapWorkout(row as AnyRow));
  const activities = (activitiesResult.data ?? []).map((row) => mapActivity(row as AnyRow, (lapsResult.data ?? []) as AnyRow[], (pointsResult.data ?? []) as AnyRow[]));
  const shoes = (shoesResult.data ?? []).map((row) => mapShoe(row as AnyRow));
  const monthlyGoals = (goalsResult.data ?? []).map((row) => mapGoal(row as AnyRow));
  const hasCloudData = workouts.length > 0 || activities.length > 0 || monthlyGoals.length > 0;
  return {
    hasCloudData,
    // Once Supabase is configured it is the source of truth. An empty cloud
    // should stay empty instead of repopulating the old local demo draft.
    state: { ...fallback, workouts, activities, shoes, monthlyGoals },
  };
}

async function upsertRows(client: SupabaseClient, table: string, rows: AnyRow[], onConflict?: string) {
  if (!rows.length) return;
  const result = await client.from(table).upsert(rows, onConflict ? { onConflict } : undefined);
  rowError(`Saving ${table}`, result.error);
}

function activityPoints(activity: Activity) {
  // `stream` is a sparse metric sample while `track` is GPS-only data. Never
  // pair them by array index; doing so creates the zig-zag route seen in old
  // imports when a sampled record has no position.
  const route = getActivityTrack(activity);
  const routePoints = route.length > 1 ? sampleActivityTrack(route) : [];
  if (!routePoints.length) {
    return activity.stream.map((point, index) => ({
      activity_id: activity.id,
      point_index: index,
      distance_km: point.distanceKm ?? null,
      latitude: point.latitude ?? null,
      longitude: point.longitude ?? null,
      elevation_m: point.elevationM ?? null,
      pace_sec_per_km: point.paceSecPerKm ?? null,
      heart_rate: point.heartRate ?? null,
      cadence: point.cadence ?? null,
      temperature_c: point.temperatureC ?? null,
      recorded_at: point.timestamp ?? null,
    }));
  }

  return routePoints.map((trackPoint, index) => {
    const metricPoint = activity.stream.reduce<ActivityPoint | undefined>((closest, point) => {
      if (trackPoint.distanceKm === undefined || point.distanceKm === undefined) return closest ?? point;
      if (!closest || closest.distanceKm === undefined) return point;
      return Math.abs(point.distanceKm - trackPoint.distanceKm) < Math.abs(closest.distanceKm - trackPoint.distanceKm) ? point : closest;
    }, undefined);
    return {
      activity_id: activity.id,
      point_index: index,
      distance_km: trackPoint.distanceKm ?? metricPoint?.distanceKm ?? null,
      latitude: trackPoint.latitude,
      longitude: trackPoint.longitude,
      elevation_m: trackPoint.elevationM ?? metricPoint?.elevationM ?? null,
      pace_sec_per_km: metricPoint?.paceSecPerKm ?? null,
      heart_rate: metricPoint?.heartRate ?? null,
      cadence: metricPoint?.cadence ?? null,
      temperature_c: metricPoint?.temperatureC ?? null,
      recorded_at: trackPoint.timestamp ?? metricPoint?.timestamp ?? null,
    };
  });
}

/** Persist the complete local snapshot; callers debounce this to avoid chatty writes. */
export async function syncStateToSupabase(state: LocalState, ownerId?: string) {
  if (!supabase) return;
  if (!ownerId) throw new Error("You must be signed in before syncing Stridebook data.");
  const client = supabase;
  await upsertRows(client, "shoes", state.shoes.map((shoe) => ({
    owner_id: ownerId,
    id: shoe.id,
    name: shoe.name,
    brand: shoe.brand ?? null,
    model: shoe.model ?? null,
    max_distance_km: shoe.maxDistanceKm,
    retired: shoe.retired ?? false,
    image_storage_path: shoe.imagePath ?? null,
    image_url: shoe.imageUrl ?? null,
  })));
  await upsertRows(client, "planned_workouts", state.workouts.map((workout) => ({
    owner_id: ownerId,
    id: workout.id,
    scheduled_date: workout.date,
    title: workout.title,
    type: workout.type,
    target_distance_km: workout.distanceKm ?? null,
    target_duration_sec: workout.durationMin ? Math.round(workout.durationMin * 60) : null,
    pace_min_sec_per_km: dbPace(workout.paceMin),
    pace_max_sec_per_km: dbPace(workout.paceMax),
    status: workout.status,
    postponed_from: workout.postponedFrom ?? null,
    notes: workout.note ?? null,
  })));
  await upsertRows(client, "activities", state.activities.map((activity) => ({
    owner_id: ownerId,
    id: activity.id,
    activity_date: activity.date,
    started_at: activity.startedAt,
    title: activity.title,
    type: activity.type,
    source: dbActivitySource(activity),
    distance_km: activity.distanceKm,
    duration_sec: Math.round(activity.durationSec),
    pace_sec_per_km: activity.paceSecPerKm,
    avg_heart_rate: activity.avgHr === undefined ? null : Math.round(activity.avgHr),
    max_heart_rate: activity.maxHr === undefined ? null : Math.round(activity.maxHr),
    avg_cadence: activity.avgCadence ?? null,
    elevation_gain_m: activity.elevationGainM ?? null,
    calories: activity.calories === undefined ? null : Math.round(activity.calories),
    shoe_id: activity.shoeId ?? null,
    rpe: activity.rpe ?? null,
    note: activity.note ?? null,
    imported_file_name: activity.importedFileName ?? null,
  })));
  await upsertRows(client, "activity_laps", state.activities.flatMap((activity) => activity.laps.map((lap: ActivityLap) => ({
    owner_id: ownerId,
    activity_id: activity.id,
    lap_number: lap.lap,
    distance_km: lap.distanceKm,
    duration_sec: Math.round(lap.durationSec),
    pace_sec_per_km: lap.paceSecPerKm ?? null,
    avg_heart_rate: lap.avgHr === undefined ? null : Math.round(lap.avgHr),
  }))), "activity_id,lap_number");
  await upsertRows(client, "activity_points", state.activities.flatMap((activity) => activityPoints(activity).map((point) => ({ ...point, owner_id: ownerId }))), "activity_id,point_index");
  await upsertRows(client, "monthly_goals", state.monthlyGoals.map((goal: MonthlyGoal) => ({
    owner_id: ownerId,
    id: goal.id,
    month_start: `${goal.month}-01`,
    target_distance_km: goal.targetDistanceKm ?? null,
    target_sessions: goal.targetSessions ?? null,
  })));
}

/** Explicit delete because snapshot upserts cannot remove rows absent from local state. */
export async function deleteWorkoutFromSupabase(workoutId: string, ownerId?: string) {
  if (!supabase) return;
  let query = supabase.from("planned_workouts").delete().eq("id", workoutId);
  if (ownerId) query = query.eq("owner_id", ownerId);
  const result = await query;
  rowError("Deleting plan", result.error);
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

/** Upload a shoe photo and return both storage metadata and its public URL. */
export async function uploadShoeImage(shoeId: string, file: File) {
  if (!supabase) return { imagePath: undefined, imageUrl: await fileToDataUrl(file) };
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `shoes/${shoeId}-${crypto.randomUUID()}.${extension}`;
  const result = await supabase.storage.from(SUPABASE_SHOE_BUCKET).upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
  if (result.error) throw new Error(`Uploading shoe image: ${result.error.message}`);
  const publicUrl = supabase.storage.from(SUPABASE_SHOE_BUCKET).getPublicUrl(path).data.publicUrl;
  return { imagePath: path, imageUrl: publicUrl };
}
