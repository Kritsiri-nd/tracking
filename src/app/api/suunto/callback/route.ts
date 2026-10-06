import { cookies } from "next/headers";
import { adminDb, apiError, exchangeToken, saveTokens, suuntoConfig, tokenUsername } from "@/lib/suunto-server";

export async function GET(request: Request) {
  let config;
  try { config = suuntoConfig(); } catch (error) { return apiError(error); }
  const destination = new URL("/?profile=1", config.origin);
  const cookieStore = await cookies();
  const expected = cookieStore.get("suunto_state")?.value;
  cookieStore.set("suunto_state", "", { httpOnly: true, secure: config.origin.startsWith("https:"), sameSite: "lax", maxAge: 0, path: "/api/suunto/callback" });
  try {
    const params = new URL(request.url).searchParams;
    const state = params.get("state");
    if (!state || !expected || state !== expected) throw new Error("Invalid state");
    // DELETE RETURNING consumes the single-use state atomically.
    const { data, error } = await adminDb().from("suunto_oauth_states").delete().eq("state", state).gt("expires_at", new Date().toISOString()).select("owner_id").maybeSingle();
    if (error || !data || params.has("error") || !params.get("code")) throw new Error("Authorization cancelled or expired");
    const tokens = await exchangeToken(new URLSearchParams({ grant_type: "authorization_code", code: params.get("code")!, redirect_uri: config.redirect }));
    const username = tokenUsername(tokens);
    if (!username || typeof username !== "string") throw new Error("Missing Suunto user");
    await saveTokens(data.owner_id, username, tokens);
    destination.searchParams.set("suunto", "connected");
  } catch { destination.searchParams.set("suunto", "failed"); }
  return Response.redirect(destination, 303);
}
