"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { suuntoFetch as request, syncSuuntoHealth } from "@/lib/suunto-client";
import { parseFitFile } from "@/lib/fit";
import type { Activity } from "@/lib/types";
import { syncSuuntoWorkouts, type SuuntoSyncResult } from "@/lib/suunto-sync";
import { GlassCard } from "./shared";

type Workout = { workoutKey: string; workoutName?: string; startTime?: number; totalDistance?: number };
export function SuuntoConnect({ onImport, onSave, activities, onOpenProgress }: { onImport: (activity: Activity) => void; onSave: (activity: Activity) => Promise<boolean>; activities: Activity[]; onOpenProgress: () => void }) {
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(Boolean(supabase));
  const [error, setError] = useState<string | undefined>(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("suunto") === "failed" ? "Suunto authorization was cancelled or expired. Please try again." : undefined);
  const [workouts, setWorkouts] = useState<Workout[]>();
  const [cooldown, setCooldown] = useState(false);
  const [syncResult, setSyncResult] = useState<SuuntoSyncResult>();
  const [syncing, setSyncing] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string[]>([]);
  const syncController = useRef<AbortController | null>(null);
  useEffect(() => () => syncController.current?.abort(), []);
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
  async function importAll() {
    const controller = new AbortController();
    syncController.current = controller;
    setSyncing(true);
    setSyncResult({ saved: 0, skipped: 0, failed: [] });
    setHealthStatus([]);
    const wait = () => new Promise<void>((resolve, reject) => {
      const abort = () => { window.clearTimeout(timer); reject(new DOMException("Import stopped", "AbortError")); };
      const timer = window.setTimeout(() => { controller.signal.removeEventListener("abort", abort); resolve(); }, 8500);
      controller.signal.addEventListener("abort", abort, { once: true });
      if (controller.signal.aborted) abort();
    });
    try {
      const result = await syncSuuntoWorkouts({
        signal: controller.signal, wait, progress: setSyncResult,
        alreadySaved: (key) => activities.some((activity) => activity.id.endsWith(`-${key}`) || activity.importedFileName === `${key}.fit`),
        list: async (offset) => {
          const { response } = await request(`workouts?offset=${offset}`, "GET", controller.signal);
          const page = await response.json();
          setWorkouts((current) => offset === 0 ? page.workouts : [...(current ?? []), ...page.workouts]);
          return page;
        },
        download: async (workout) => {
          const { response, owner } = await request(`workouts/${encodeURIComponent(workout.workoutKey)}`, "GET", controller.signal);
          const activity = await parseFitFile(new File([await response.blob()], `${workout.workoutKey}.fit`), "me");
          return { ...activity, id: `suunto-${owner}-${workout.workoutKey}` };
        },
        save: onSave,
      });
      setSyncResult(result);
      const now = Date.now();
      await syncSuuntoHealth(now - 28 * 86400000, now, controller.signal, (kind, count, error) => {
        setHealthStatus((current) => [...current, error ? `${kind}: ${error}` : `${kind}: ${count} samples saved`]);
      });
    } catch (caught) {
      if (controller.signal.aborted) setError("Import stopped. Completed runs are already saved in Progress.");
      else throw caught;
    } finally { syncController.current = null; setSyncing(false); setCooldown(true); }
  }
  const button = "tap rounded-full bg-[#dce4d7] px-4 py-2 text-sm font-semibold text-[#53644e] disabled:opacity-50";
  return <GlassCard className="p-5 sm:p-6">
    <h2 className="text-lg font-medium">Suunto</h2>
    <p className="mt-2 text-sm text-[#858880]">{connected ? `Connected as ${username}. Save workouts from the last 30 days plus sleep, daily activity and recovery from the last 28 days. Existing runs are skipped.` : "Connect your Suunto account to import workouts, sleep, daily activity and recovery."}</p>
    <p className="mt-2 text-xs text-[#858880]">Developer API: 200 calls/week. Each list or FIT download uses one call; wait 8 seconds between requests.</p>
    {error && <p role="alert" className="mt-3 text-sm text-[#b46f67]">{error}</p>}
    <div className="mt-4 flex flex-wrap gap-2">
      {!connected ? <button className={button} disabled={busy || checking || !supabase} onClick={() => void run(async () => {
        const { response } = await request("connect", "POST"); window.location.assign((await response.json()).url);
      })}>{checking ? "Checking connection…" : busy ? "Connecting…" : "Connect Suunto"}</button> : <>
        <button className={button} disabled={busy || cooldown} onClick={() => void run(importAll)}>{busy ? "Importing to Progress…" : cooldown ? "Wait 8 seconds…" : "Load & save all Suunto data"}</button>
        {syncing && <button className={button} onClick={() => syncController.current?.abort()}>Stop import</button>}
        <button className={button} disabled={busy} onClick={() => void run(async () => {
          await request("connection", "DELETE"); setConnected(false); setUsername(undefined); setWorkouts(undefined);
        })}>Disconnect</button>
      </>}
    </div>
    {syncResult && <div role="status" className="mt-4 rounded-2xl bg-white/30 p-3 text-sm">
      <p>{syncResult.saved} saved to Progress · {syncResult.skipped} already saved · {syncResult.failed.length} failed{busy ? " · Working…" : ""}</p>
      {healthStatus.map((message) => <p key={message} className="mt-1 text-xs">{message}</p>)}
      {!busy && healthStatus.length > 0 && <p className="mt-2 text-xs">Open Progress → Health to view sleep, daily activity and recovery.</p>}
      {busy && <p className="mt-1 text-xs text-[#858880]">Keep this page open. Requests are spaced 8.5 seconds apart to respect Suunto limits.</p>}
      {!!syncResult.failed.length && <details className="mt-2"><summary>Show failed workouts</summary>{syncResult.failed.map((message, index) => <p key={index} className="mt-1 text-xs">{message}</p>)}</details>}
      {!busy && <button className={`${button} mt-3`} onClick={onOpenProgress}>View Progress</button>}
    </div>}
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
