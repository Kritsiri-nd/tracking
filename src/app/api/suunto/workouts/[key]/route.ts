import { apiError, requireOwner, suuntoRequest, SuuntoError } from "@/lib/suunto-server";

export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { owner } = await requireOwner(request);
    const { key } = await params;
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(key)) throw new SuuntoError("Invalid workout key.", 400);
    // Suunto authorizes access to the requested FIT with this owner's OAuth token.
    const response = await suuntoRequest(owner, `/v3/workouts/${encodeURIComponent(key)}/fit`);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 20 * 1024 * 1024) throw new SuuntoError("This workout is too large to import.", 413);
    return new Response(buffer, { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store", "Content-Disposition": `attachment; filename="${key}.fit"` } });
  } catch (error) { return apiError(error); }
}
