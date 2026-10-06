import { apiError, requireOwner, suuntoConfig, SuuntoError } from "@/lib/suunto-server";

export async function GET(request: Request) {
  try {
    suuntoConfig();
    const { db, owner } = await requireOwner(request);
    const { data, error } = await db.from("suunto_connections").select("username,updated_at").eq("owner_id", owner).maybeSingle();
    if (error) throw new SuuntoError("Suunto database setup is incomplete.", 503);
    return Response.json({ connected: Boolean(data), username: data?.username }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request) {
  try {
    const { db, owner } = await requireOwner(request);
    const { error } = await db.from("suunto_connections").delete().eq("owner_id", owner);
    if (error) throw new SuuntoError("Could not disconnect Suunto.");
    return Response.json({ connected: false });
  } catch (error) { return apiError(error); }
}
