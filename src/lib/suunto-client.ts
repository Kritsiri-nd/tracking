import { supabase } from "./supabase";
import { healthKinds, type HealthKind } from "./suunto-health";

export async function suuntoFetch(path: string, method = "GET", signal?: AbortSignal) {
  if (!supabase) throw new Error("Sign in to connect Suunto.");
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sign in to connect Suunto.");
  const response = await fetch(`/api/suunto/${path}`, { method, headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store", signal });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw Object.assign(new Error(result.error || "Could not reach Suunto. Try again."), { status: response.status });
  }
  return { response, owner: data.session.user.id };
}
export function waitForSuunto(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException("Import stopped", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 8500);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}
export async function syncSuuntoHealth(from: number, to: number, signal: AbortSignal, onProgress: (kind: HealthKind, count: number, error?: string) => void) {
  const result: { kind: HealthKind; count: number; error?: string }[] = [];
  for (const kind of healthKinds) {
    signal.throwIfAborted();
    await waitForSuunto(signal);
    try {
      const { response } = await suuntoFetch(`health/sync?kind=${kind}&from=${from}&to=${to}`, "POST", signal);
      const { count } = await response.json();
      result.push({ kind, count }); onProgress(kind, count);
    } catch (error) {
      if (signal.aborted || (error && typeof error === "object" && "status" in error && [401, 429, 503].includes(Number(error.status)))) throw error;
      const message = error instanceof Error ? error.message : "Health sync failed";
      result.push({ kind, count: 0, error: message }); onProgress(kind, 0, message);
    }
  }
  return result;
}
