import { adminDb, apiError, requiredEnv, SuuntoError } from "@/lib/suunto-server";
import { verifySuuntoSignature } from "@/lib/suunto-security";
import { normalizeHealthSamples, type HealthKind } from "@/lib/suunto-health";
import { storeHealthSamples } from "@/lib/suunto-health-store";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    if (Buffer.byteLength(body) > 256000) throw new SuuntoError("Notification too large.", 413);
    if (!verifySuuntoSignature(body, request.headers.get("x-hmac-sha256-signature"), requiredEnv("SUUNTO_WEBHOOK_SECRET"))) throw new SuuntoError("Invalid notification signature.", 401);
    let event;
    try { event = JSON.parse(body); } catch { throw new SuuntoError("Invalid notification.", 400); }
    const kind = ({ SUUNTO_247_ACTIVITY_CREATED: "activity", SUUNTO_247_SLEEP_CREATED: "sleep", SUUNTO_247_RECOVERY_CREATED: "recovery" } as Record<string, HealthKind>)[event.type];
    if (kind) {
      if (typeof event.username !== "string" || event.username.length > 200) throw new SuuntoError("Invalid notification.", 400);
      try { normalizeHealthSamples(kind, event.samples); } catch { throw new SuuntoError("Invalid health notification.", 400); }
      const db = adminDb();
      const { data, error } = await db.from("suunto_connections").select("owner_id").eq("username", event.username).maybeSingle();
      if (error) throw new SuuntoError("Notification storage unavailable.");
      if (data) await storeHealthSamples(db, data.owner_id, kind, event.samples);
      return Response.json({ accepted: true });
    }
    if (event.type !== "WORKOUT_CREATED") return Response.json({ accepted: true });
    const key = event.workout?.workoutKey;
    if (typeof event.username !== "string" || event.username.length > 200 || typeof key !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(key)) throw new SuuntoError("Invalid notification.", 400);
    const db = adminDb();
    const { data, error: lookupError } = await db.from("suunto_connections").select("owner_id").eq("username", event.username).maybeSingle();
    if (lookupError) throw new SuuntoError("Notification storage unavailable.");
    if (data) {
      const { error } = await db.from("suunto_notifications").upsert({ username: event.username, workout_key: key }, { onConflict: "username,workout_key", ignoreDuplicates: true });
      if (error) throw new SuuntoError("Could not save notification.");
    }
    // Persist first, then acknowledge; no FIT download delays the 2-second response.
    return Response.json({ accepted: true });
  } catch (error) { return apiError(error); }
}
