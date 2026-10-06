import { apiError, requireOwner, suuntoRequest, SuuntoError } from "@/lib/suunto-server";
import { healthApiPath, healthKinds, healthRange, type HealthKind } from "@/lib/suunto-health";
import { storeHealthSamples } from "@/lib/suunto-health-store";

export async function POST(request: Request) {
  try {
    const { db, owner } = await requireOwner(request);
    const params = new URL(request.url).searchParams;
    const kind = params.get("kind") as HealthKind;
    if (!healthKinds.includes(kind)) throw new SuuntoError("Invalid health category.", 400);
    let range;
    try { range = healthRange(params.get("from") ?? "", params.get("to") ?? ""); } catch { throw new SuuntoError("Choose a date range of 1 to 28 days.", 400); }
    const response = await suuntoRequest(owner, healthApiPath(kind, range.from, range.to));
    let count;
    try { count = await storeHealthSamples(db, owner, kind, await response.json()); } catch (error) {
      if (error instanceof SuuntoError) throw error;
      throw new SuuntoError("Suunto returned invalid health data. Existing data has been kept.", 502);
    }
    const { error } = await db.from("suunto_health_sync").upsert({ owner_id: owner, kind, synced_at: new Date().toISOString(), range_from: new Date(range.from).toISOString(), range_to: new Date(range.to).toISOString(), sample_count: count });
    if (error) throw new SuuntoError("Health samples saved, but sync status could not be saved.", 503);
    return Response.json({ kind, count }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
