import { apiError, requireOwner, SuuntoError } from "@/lib/suunto-server";
import { healthRange } from "@/lib/suunto-health";

export async function GET(request: Request) {
  try {
    const { db, owner } = await requireOwner(request);
    const params = new URL(request.url).searchParams;
    let range;
    try { range = healthRange(params.get("from") ?? "", params.get("to") ?? ""); } catch { throw new SuuntoError("Choose a date range of 1 to 28 days.", 400); }
    const samples = [];
    // Supabase's default result cap is 1,000; page until the entire range is read.
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from("suunto_health_samples").select("kind,external_key,recorded_at,entry_data").eq("owner_id", owner).gte("recorded_at", new Date(range.from).toISOString()).lt("recorded_at", new Date(range.to).toISOString()).order("recorded_at").order("kind").order("external_key").range(offset, offset + 999);
      if (error) throw new SuuntoError("Health data setup is incomplete. Apply the Suunto health migration.", 503);
      samples.push(...(data ?? []));
      if ((data?.length ?? 0) < 1000) break;
      if (samples.length >= 100000) throw new SuuntoError("Choose a shorter health date range.", 413);
    }
    const { data: sync, error } = await db.from("suunto_health_sync").select("kind,synced_at,range_from,range_to,sample_count").eq("owner_id", owner);
    if (error) throw new SuuntoError("Could not load health sync status.", 503);
    return Response.json({ samples, sync: sync ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
