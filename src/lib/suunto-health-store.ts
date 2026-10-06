import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeHealthSamples, type HealthKind } from "./suunto-health";
import { SuuntoError } from "./suunto-server";

export async function storeHealthSamples(db: SupabaseClient, owner: string, kind: HealthKind, input: unknown) {
  const samples = normalizeHealthSamples(kind, input);
  for (let offset = 0; offset < samples.length; offset += 500) {
    const { error } = await db.from("suunto_health_samples").upsert(samples.slice(offset, offset + 500).map((sample) => ({ ...sample, owner_id: owner, updated_at: new Date().toISOString() })), { onConflict: "owner_id,kind,external_key" });
    if (error) throw new SuuntoError("Could not save health data. Check the Suunto health migration.", 503);
  }
  return samples.length;
}
