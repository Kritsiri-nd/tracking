import { apiError, requireOwner, suuntoRequest, SuuntoError } from "@/lib/suunto-server";

export async function GET(request: Request) {
  try {
    const { owner, db } = await requireOwner(request);
    const offset = Number(new URL(request.url).searchParams.get("offset") ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw new SuuntoError("Invalid workout page.", 400);
    const response = await suuntoRequest(owner, `/v3/workouts?since=${Date.now() - 30 * 86400000}&limit=20&offset=${offset}&filter-by-modification-time=false`);
    const result = await response.json();
    if (result.error || !Array.isArray(result.payload)) throw new SuuntoError("Suunto returned an invalid workout list.", 502);
    const { data: connection, error: connectionError } = await db.from("suunto_connections").select("username").eq("owner_id", owner).single();
    if (connectionError) throw new SuuntoError("Could not read Suunto notifications.");
    const { data: notifications, error: notificationError } = await db.from("suunto_notifications").select("workout_key").eq("username", connection.username).order("created_at", { ascending: false }).limit(20);
    if (notificationError) throw new SuuntoError("Could not read Suunto notifications.");
    const known = new Set(result.payload.map((workout: { workoutKey: string }) => workout.workoutKey));
    const queued = offset === 0 ? (notifications ?? []).filter((event) => !known.has(event.workout_key)).map((event) => ({ workoutKey: event.workout_key })) : [];
    return Response.json({ workouts: [...queued, ...result.payload], nextOffset: result.payload.length === 20 ? offset + 20 : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
