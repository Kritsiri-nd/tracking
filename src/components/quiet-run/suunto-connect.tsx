"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { parseFitFile } from "@/lib/fit";
import type { Activity } from "@/lib/types";
import { GlassCard } from "./shared";

type Workout = { workoutKey: string; workoutName?: string; startTime?: number; totalDistance?: number };
async function request(path: string, method = "GET") {
  const { data } = await supabase!.auth.getSession();
  if (!data.session) throw new Error("Sign in to connect Suunto.");
  const response = await fetch(`/api/suunto/${path}`, { method, headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store" });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "Could not reach Suunto. Try again.");
  }
  return { response, owner: data.session.user.id };
}
export function SuuntoConnect({ onImport }: { onImport: (activity: Activity) => void }) {
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(Boolean(supabase));
  const [error, setError] = useState<string | undefined>(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("suunto") === "failed" ? "Suunto authorization was cancelled or expired. Please try again." : undefined);
  const [workouts, setWorkouts] = useState<Workout[]>();
  const [cooldown, setCooldown] = useState(false);
  useEffect(() => {
    let active = true;
    if (!supabase) return;
    void request("connection").then(async ({ response }) => {
      const result = await response.json();
      if (active) { setConnected(result.connected); setUsername(result.username); }
    }).catch((caught) => { if (active) setError(caught.message); }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(false), 8000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(undefined);
    try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Suunto request failed."); }
    finally { setBusy(false); }
  }
  const button = "tap rounded-full bg-[#dce4d7] px-4 py-2 text-sm font-semibold text-[#53644e] disabled:opacity-50";
  return <GlassCard className="p-5 sm:p-6">
    <h2 className="text-lg font-medium">Suunto</h2>
    <p className="mt-2 text-sm text-[#858880]">{connected ? `Connected as ${username}. Choose a run to review before saving.` : "Connect your Suunto account to import runs with heart rate, laps and GPS."}</p>
    <p className="mt-2 text-xs text-[#858880]">Developer API: 200 calls/week. Each list or FIT download uses one call; wait 8 seconds between requests.</p>
    {error && <p role="alert" className="mt-3 text-sm text-[#b46f67]">{error}</p>}
    <div className="mt-4 flex flex-wrap gap-2">
      {!connected ? <button className={button} disabled={busy || checking || !supabase} onClick={() => void run(async () => {
        const { response } = await request("connect", "POST"); window.location.assign((await response.json()).url);
      })}>{checking ? "Checking connection…" : busy ? "Connecting…" : "Connect Suunto"}</button> : <>
        <button className={button} disabled={busy || cooldown} onClick={() => void run(async () => {
          setCooldown(true); const { response } = await request("workouts"); setWorkouts((await response.json()).workouts);
        })}>{busy ? "Loading…" : cooldown ? "Wait 8 seconds…" : "Load last 30 days"}</button>
        <button className={button} disabled={busy} onClick={() => void run(async () => {
          await request("connection", "DELETE"); setConnected(false); setUsername(undefined); setWorkouts(undefined);
        })}>Disconnect</button>
      </>}
    </div>
    {connected && <p className="mt-2 text-xs text-[#858880]">Disconnect removes access stored by Stridebook. You can also revoke access in your Suunto account settings.</p>}
    {workouts && <div className="mt-4 space-y-2">
      {!workouts.length && <p className="text-sm text-[#858880]">No recent workouts found.</p>}
      {workouts.map((workout) => <div key={workout.workoutKey} className="flex items-center justify-between gap-3 rounded-2xl bg-white/30 p-3">
        <div><p className="text-sm font-semibold">{workout.workoutName || "Suunto workout"}</p><p className="text-xs text-[#858880]">{workout.startTime ? new Date(workout.startTime).toLocaleDateString() : "New notification"}{typeof workout.totalDistance === "number" ? ` · ${(workout.totalDistance / 1000).toFixed(2)} km` : ""}</p></div>
        <button className={button} disabled={busy || cooldown} onClick={() => void run(async () => {
          setCooldown(true);
          const { response, owner } = await request(`workouts/${encodeURIComponent(workout.workoutKey)}`);
          const activity = await parseFitFile(new File([await response.blob()], `${workout.workoutKey}.fit`), "me");
          onImport({ ...activity, id: `suunto-${owner}-${workout.workoutKey}` });
        })}>Review run</button>
      </div>)}
    </div>}
  </GlassCard>;
}
