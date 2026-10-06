"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { shiftBangkokDateKey } from "@/lib/date";
import { suuntoFetch, syncSuuntoHealth } from "@/lib/suunto-client";
import { dailyHealthRows, healthKinds, healthNumber, healthRange, percentage, sleepDate, sleepHours, type HealthSample, type HealthSync } from "@/lib/suunto-health";
import { GlassCard, cn } from "./shared";

const display = (value: number | undefined, suffix = "", digits = 0) => value === undefined ? "—" : `${value.toLocaleString("en-US", { maximumFractionDigits: digits })}${suffix}`;
const time = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) : "—";
const labels = { sleep: "Sleep", daily: "Daily totals", activity: "Heart & activity", recovery: "Recovery" };

export function HealthView({ today }: { today: string }) {
  const [fromDate, setFromDate] = useState(() => shiftBangkokDateKey(today, -27));
  const [toDate, setToDate] = useState(today);
  const [samples, setSamples] = useState<HealthSample[]>([]);
  const [sync, setSync] = useState<HealthSync[]>([]);
  const [section, setSection] = useState<typeof healthKinds[number]>("sleep");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const controller = useRef<AbortController | null>(null);
  const range = useMemo(() => {
    try { return healthRange(String(Date.parse(`${fromDate}T00:00:00+07:00`)), String(Date.parse(`${toDate}T00:00:00+07:00`) + 86400000)); } catch { return null; }
  }, [fromDate, toDate]);

  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      setSamples([]); setSync([]); setError("");
      if (!range) return;
      setLoading(true);
      try {
        const { response } = await suuntoFetch(`health?from=${range.from}&to=${range.to}`, "GET", abort.signal);
        const result = await response.json();
        if (!abort.signal.aborted) { setSamples(result.samples); setSync(result.sync); }
      } catch (e) { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "Could not load health data."); }
      finally { if (!abort.signal.aborted) setLoading(false); }
    }, 0);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [range]);
  useEffect(() => () => controller.current?.abort(), []);

  async function refresh() {
    if (!range || busy) return;
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setError(""); setMessages([]);
    try {
      await syncSuuntoHealth(range.from, range.to, abort.signal, (kind, count, issue) => setMessages((previous) => [...previous, `${labels[kind]}: ${issue || `${count} samples saved`}`]));
    } catch (e) { setError(abort.signal.aborted ? "Stopped. Saved data is kept." : e instanceof Error ? e.message : "Sync failed."); }
    finally {
      try {
        const { response } = await suuntoFetch(`health?from=${range.from}&to=${range.to}`);
        const result = await response.json();
        setSamples(result.samples); setSync(result.sync);
      } catch (e) { setError(e instanceof Error ? e.message : "Could not reload saved data."); }
      setBusy(false); controller.current = null;
    }
  }

  const sources = [...new Set(samples.filter((s) => s.kind === "daily").map((s) => String(s.entry_data.source)))].sort();
  const selectedSource = sources.includes(source) ? source : sources[0] ?? "";
  const daily = dailyHealthRows(samples, selectedSource);
  const rows = samples.filter((s) => s.kind === section).sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
  const nights = samples.filter((s) => s.kind === "sleep" && s.entry_data.IsNap !== true).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  const sleepChart = nights.map((s) => ({ date: sleepDate(s), deep: sleepHours(s.entry_data.DeepSleepDuration), light: sleepHours(s.entry_data.LightSleepDuration), rem: sleepHours(s.entry_data.REMSleepDuration), hrv: healthNumber(s.entry_data.AvgHRV) }));
  const latest = rows[0]?.entry_data ?? {};
  const chart = [...rows].reverse().filter((_, index) => index % Math.max(1, Math.ceil(rows.length / 1000)) === 0 || index === rows.length - 1).map((s) => ({ date: time(s.recorded_at), hr: healthNumber(s.entry_data.HR), balance: percentage(s.entry_data.Balance) }));
  return <div className="space-y-5">
    <GlassCard className="p-5">
      <h2 className="text-xl font-medium">Suunto health</h2>
      <p className="mt-2 text-sm text-[#777b73]">Sleep, daily activity and recovery from your Suunto account. Times use Bangkok time. Choose up to 28 days per sync; previously saved history stays available.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">From<input aria-label="Health from date" type="date" value={fromDate} disabled={busy} onChange={(e) => setFromDate(e.target.value)} className="mt-1 block rounded-xl bg-white/70 p-2" /></label>
        <label className="text-sm">To<input aria-label="Health to date" type="date" value={toDate} max={today} disabled={busy} onChange={(e) => setToDate(e.target.value)} className="mt-1 block rounded-xl bg-white/70 p-2" /></label>
        <button type="button" disabled={busy || !range} onClick={refresh} className="tap rounded-xl bg-[#7f9277] px-4 py-2 text-white disabled:opacity-50">{busy ? "Syncing all health data…" : "Sync all health data"}</button>
        {busy && <button type="button" onClick={() => controller.current?.abort()} className="tap rounded-xl bg-white/60 px-4 py-2">Stop</button>}
      </div>
      {!range && <p role="alert" className="mt-3 text-sm text-[#a4563e]">Choose valid dates spanning 1–28 days.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-[#a4563e]">{error}</p>}
      <div aria-live="polite" className="mt-3 space-y-1 text-sm">{loading && <p>Loading saved data…</p>}{messages.map((message, i) => <p key={i}>{message}</p>)}</div>
      <div className="mt-4 grid gap-2 sm:grid-cols-4">{healthKinds.map((kind) => { const status = sync.find((s) => s.kind === kind); return <div key={kind} className="rounded-xl bg-white/40 p-3 text-xs"><p className="font-semibold">{labels[kind]}</p><p className="mt-1">{status ? time(status.synced_at) : "Not synced yet"}</p>{status && <p className="mt-1">{status.sample_count.toLocaleString()} samples · {time(status.range_from)} – {time(status.range_to)}</p>}</div>; })}</div>
    </GlassCard>
    <div className="flex flex-wrap gap-2" aria-label="Health categories">{healthKinds.map((kind) => <button key={kind} type="button" aria-pressed={section === kind} onClick={() => setSection(kind)} className={cn("tap rounded-xl px-4 py-2 text-sm", section === kind ? "bg-[#7f9277] text-white" : "bg-white/50")}>{labels[kind]}</button>)}</div>
    {!loading && !rows.length && <GlassCard className="p-5 text-sm text-[#777b73]">No {labels[section].toLowerCase()} data in this range. Connect Suunto in Profile and sync. Availability depends on your watch, recorded data and Suunto 24/7 API access.</GlassCard>}
    {section === "sleep" && rows.length > 0 && <>
      <GlassCard className="p-5"><h3 className="font-semibold">Sleep stages · hours</h3><div className="mt-3 h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={sleepChart}><CartesianGrid vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="deep" name="Deep (h)" stackId="sleep" fill="#657d9a" /><Bar dataKey="light" name="Light (h)" stackId="sleep" fill="#a6b9c9" /><Bar dataKey="rem" name="REM (h)" stackId="sleep" fill="#b7a1c0" /></BarChart></ResponsiveContainer></div><p className="text-xs text-[#777b73]">Overnight sleep only. Missing stages stay blank; naps appear in the history below.</p></GlassCard>
      <GlassCard className="p-5"><h3 className="font-semibold">Overnight HRV · ms</h3><div className="mt-3 h-44"><ResponsiveContainer width="100%" height="100%"><LineChart data={sleepChart}><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Line dataKey="hrv" name="HRV (ms)" stroke="#7f9277" connectNulls={false} /></LineChart></ResponsiveContainer></div></GlassCard>
      <GlassCard className="p-5"><h3 className="mb-3 font-semibold">Sleep history</h3><div className="space-y-3">{rows.map((s) => { const d = s.entry_data; return <details key={s.external_key} className="rounded-xl bg-white/40 p-3 text-sm"><summary className="cursor-pointer">{sleepDate(s)} · {d.IsNap === true ? "Nap" : "Sleep"} · {display(sleepHours(d.Duration), " h", 2)} · HRV {display(healthNumber(d.AvgHRV), " ms", 1)}</summary><dl className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries({ "Bedtime": time(d.BedtimeStart), "Wake time": time(d.BedtimeEnd), "Deep / light / REM": [d.DeepSleepDuration, d.LightSleepDuration, d.REMSleepDuration].map((v) => display(sleepHours(v), " h", 2)).join(" / "), "Sleep quality": display(healthNumber(d.SleepQualityScore)), "Average / minimum HR": `${display(healthNumber(d.HRAvg), " bpm")} / ${display(healthNumber(d.HRMin), " bpm")}`, "Max SpO₂": display(percentage(d.MaxSpo2), "%", 1), "Sleep onset / awake after onset / before getting up": [d.SleepOnsetLatencyDuration, d.WakeAfterSleepOnsetDuration, d.WakeBeforeOffBedDuration].map((v) => display(healthNumber(v) === undefined ? undefined : Number(v) / 60, " min", 1)).join(" / "), "HRV sample count": display(healthNumber(d.AvgHRVSampleCount)), "Feeling (Suunto code)": display(healthNumber(d.Feeling)), "Altitude": display(healthNumber(d.Altitude, -500), " m") }).map(([key, value]) => <div key={key}><dt className="text-xs text-[#777b73]">{key}</dt><dd>{value}</dd></div>)}</dl></details>; })}</div></GlassCard>
    </>}
    {section === "daily" && rows.length > 0 && <GlassCard className="p-5"><label className="text-sm">Data source<select value={selectedSource} onChange={(e) => setSource(e.target.value)} className="ml-2 max-w-full rounded-xl bg-white/70 p-2">{sources.map((item) => <option key={item}>{item}</option>)}</select></label><p className="mt-2 text-xs text-[#777b73]">Provider daily totals; sources are shown separately to avoid counting the same day twice. Energy is converted from joules to kcal.</p><div className="mt-4 h-52"><ResponsiveContainer width="100%" height="100%"><BarChart data={daily}><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="steps" name="Steps" fill="#7f9277" /></BarChart></ResponsiveContainer></div><DataTable headers={["Date", "Steps", "Energy (kcal)"]} rows={[...daily].reverse().map((d) => [d.date, display(d.steps), display(d.kcal, "", 1)])} /></GlassCard>}
    {section === "activity" && rows.length > 0 && <GlassCard className="p-5"><h3 className="font-semibold">Latest sample · {time(rows[0].recorded_at)}</h3><p className="mt-2 text-sm">HR {display(healthNumber(latest.HR), " bpm")} · SpO₂ {display(percentage(latest.SpO2), "%", 1)} · HRV {display(healthNumber(latest.HRV), " ms", 1)}</p><div className="mt-4 h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><XAxis dataKey="date" hide /><YAxis /><Tooltip /><Line dataKey="hr" name="HR (bpm)" stroke="#bd755c" dot={false} connectNulls={false} /></LineChart></ResponsiveContainer></div><DataTable headers={["Time", "HR", "HR min/max", "HRV ms", "SpO₂", "Steps", "kcal", "Altitude m"]} rows={rows.map((s) => { const d = s.entry_data, ext = d.HRExt as { Min?: number; Max?: number } | undefined; return [time(s.recorded_at), display(healthNumber(d.HR)), `${display(healthNumber(ext?.Min))}/${display(healthNumber(ext?.Max))}`, display(healthNumber(d.HRV), "", 1), display(percentage(d.SpO2), "%", 1), display(healthNumber(d.StepCount)), display(healthNumber(d.EnergyConsumption) === undefined ? undefined : Number(d.EnergyConsumption) / 4184, "", 1), display(healthNumber(d.Altitude, -500))]; })} /></GlassCard>}
    {section === "recovery" && rows.length > 0 && <GlassCard className="p-5"><h3 className="font-semibold">Body resources · {time(rows[0].recorded_at)}</h3><p className="mt-2 text-sm">Balance {display(percentage(latest.Balance), "%", 1)} · Stress state (Suunto code) {display(healthNumber(latest.StressState))}</p><div className="mt-4 h-52"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><XAxis dataKey="date" hide /><YAxis domain={[0, 100]} /><Tooltip /><Line dataKey="balance" name="Body resources (%)" stroke="#7f9277" dot={false} connectNulls={false} /></LineChart></ResponsiveContainer></div><DataTable headers={["Time", "Body resources", "Stress state (code)"]} rows={rows.map((s) => [time(s.recorded_at), display(percentage(s.entry_data.Balance), "%", 1), display(healthNumber(s.entry_data.StressState))])} /></GlassCard>}
    <p className="text-xs text-[#777b73]">— means Suunto did not provide a valid value. Health data belongs to the signed-in account. Watch measurements are displayed as recorded. Heart and recovery charts show up to 1,000 sampled points; all saved measurements are available in the paged history.</p>
  </div>;
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const [page, setPage] = useState(0);
  const current = Math.min(page, Math.max(0, Math.ceil(rows.length / 100) - 1));
  return <><div className="mt-4 max-h-96 overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-[#f5f2e9]"><tr>{headers.map((h) => <th key={h} className="whitespace-nowrap p-2 text-xs">{h}</th>)}</tr></thead><tbody>{rows.slice(current * 100, (current + 1) * 100).map((row, i) => <tr key={i} className="border-t border-black/5">{row.map((cell, j) => <td key={j} className="whitespace-nowrap p-2">{cell}</td>)}</tr>)}</tbody></table></div><div className="mt-3 flex items-center gap-3 text-xs"><button type="button" disabled={!current} onClick={() => setPage(current - 1)} className="tap rounded-lg bg-white/50 p-2 disabled:opacity-40">Previous samples</button><span>{current * 100 + 1}–{Math.min((current + 1) * 100, rows.length)} / {rows.length.toLocaleString()}</span><button type="button" disabled={(current + 1) * 100 >= rows.length} onClick={() => setPage(current + 1)} className="tap rounded-lg bg-white/50 p-2 disabled:opacity-40">Next samples</button></div></>;
}
