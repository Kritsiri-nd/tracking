import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { apiError, requireOwner, suuntoConfig, SuuntoError } from "@/lib/suunto-server";

export async function POST(request: Request) {
  try {
    const config = suuntoConfig();
    const { db, owner } = await requireOwner(request);
    const state = randomBytes(32).toString("hex");
    const { error } = await db.from("suunto_oauth_states").insert({ state, owner_id: owner, expires_at: new Date(Date.now() + 600000).toISOString() });
    if (error) throw new SuuntoError("Suunto database setup is incomplete.", 503);
    await db.from("suunto_oauth_states").delete().lt("expires_at", new Date().toISOString());
    (await cookies()).set("suunto_state", state, { httpOnly: true, secure: config.origin.startsWith("https:"), sameSite: "lax", maxAge: 600, path: "/api/suunto/callback" });
    const url = new URL("https://cloudapi-oauth.suunto.com/oauth/authorize");
    url.search = new URLSearchParams({ response_type: "code", client_id: config.clientId, redirect_uri: config.redirect, state }).toString();
    return Response.json({ url: url.href }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
