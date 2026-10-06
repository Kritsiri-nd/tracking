import { createClient } from "@supabase/supabase-js";
import { openToken, sealToken } from "./suunto-security";

export class SuuntoError extends Error {
  constructor(message: string, public status = 500) { super(message); }
}
export function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new SuuntoError("Suunto is not configured on this server yet.", 503);
  return value;
}
export function suuntoConfig() {
  const key = requiredEnv("SUUNTO_TOKEN_ENCRYPTION_KEY");
  if (!/^[a-f0-9]{64}$/i.test(key)) throw new SuuntoError("Suunto encryption configuration is invalid.", 503);
  const redirect = new URL(requiredEnv("SUUNTO_REDIRECT_URI"));
  if (redirect.pathname !== "/api/suunto/callback") throw new SuuntoError("Suunto callback configuration is invalid.", 503);
  return { key, redirect: redirect.href, origin: redirect.origin, clientId: requiredEnv("SUUNTO_CLIENT_ID"), secret: requiredEnv("SUUNTO_CLIENT_SECRET"), subscription: requiredEnv("SUUNTO_SUBSCRIPTION_KEY") };
}
export function adminDb() {
  return createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function requireOwner(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) throw new SuuntoError("Sign in to connect Suunto.", 401);
  const db = adminDb();
  const { data, error } = await db.auth.getUser(bearer);
  if (error || !data.user) throw new SuuntoError("Your session expired. Please sign in again.", 401);
  return { db, owner: data.user.id };
}
type Tokens = { access_token: string; refresh_token: string; expires_in: number; user?: string };
export async function exchangeToken(params: URLSearchParams): Promise<Tokens> {
  const config = suuntoConfig();
  const response = await fetch("https://cloudapi-oauth.suunto.com/oauth/token", { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: params, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new SuuntoError("Suunto authorization failed. Please connect again.", 502);
  const tokens = await response.json() as Tokens;
  if (!tokens.access_token || !tokens.refresh_token || !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0) throw new SuuntoError("Suunto returned an invalid authorization response.", 502);
  return tokens;
}
export function tokenUsername(tokens: Tokens) {
  if (tokens.user) return tokens.user;
  try { return JSON.parse(Buffer.from(tokens.access_token.split(".")[1], "base64url").toString()).user as string; } catch { return undefined; }
}
export async function saveTokens(owner: string, username: string, tokens: Tokens) {
  const { error } = await adminDb().from("suunto_connections").upsert({ owner_id: owner, username, tokens: sealToken(JSON.stringify(tokens), suuntoConfig().key), expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), updated_at: new Date().toISOString() });
  if (error) throw new SuuntoError("Could not save Suunto connection. Check the database migration.");
}
export async function suuntoRequest(owner: string, path: string) {
  const db = adminDb();
  const { data, error } = await db.from("suunto_connections").select("*").eq("owner_id", owner).maybeSingle();
  if (error) throw new SuuntoError("Could not read Suunto connection.");
  if (!data) throw new SuuntoError("Connect Suunto first.", 409);
  // Atomic per-account cooldown works across server instances and browser tabs.
  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await db.from("suunto_connections").update({ last_api_at: now }).eq("owner_id", owner).or(`last_api_at.is.null,last_api_at.lt.${new Date(Date.now() - 8000).toISOString()}`).select("owner_id");
  if (claimError) throw new SuuntoError("Could not check API quota.");
  if (!claimed?.length) throw new SuuntoError("Please wait 8 seconds before the next Suunto request.", 429);
  let tokens = JSON.parse(openToken(data.tokens, suuntoConfig().key)) as Tokens;
  if (new Date(data.expires_at).getTime() < Date.now() + 60000) {
    tokens = await exchangeToken(new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokens.refresh_token }));
    await saveTokens(owner, data.username, tokens);
  }
  const response = await fetch(`https://cloudapi.suunto.com${path}`, { headers: { Authorization: `Bearer ${tokens.access_token}`, "Ocp-Apim-Subscription-Key": suuntoConfig().subscription }, cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new SuuntoError(response.status === 429 ? "Suunto API quota reached. Try again later." : response.status === 401 ? "Suunto authorization expired. Disconnect and reconnect." : "Suunto could not return this workout. Try again later.", response.status === 429 ? 429 : 502);
  return response;
}
export function apiError(error: unknown) {
  return Response.json({ error: error instanceof SuuntoError ? error.message : "Suunto request failed. Please try again." }, { status: error instanceof SuuntoError ? error.status : 500, headers: { "Cache-Control": "no-store" } });
}
