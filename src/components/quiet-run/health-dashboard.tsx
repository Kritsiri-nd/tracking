"use client";

import { ArrowUpRight, BedDouble, Footprints, HeartPulse, Moon, Sparkles, Sun, Waves } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { healthNumber, percentage, sleepDate, sleepHours, type HealthKind, type HealthSample } from "@/lib/suunto-health";

const number = (value: number | undefined, digits = 0) => value === undefined ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: digits });
const clock = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }) : "—";
const dateLabel = (date?: string) => date ? new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "No recorded data";
const tooltip = { background: "var(--health-tooltip)", color: "var(--dash-text)", border: "1px solid var(--health-border)", borderRadius: 14, fontSize: 12 };
const stress = (value: unknown) => ({ 1: "Relaxing", 2: "Active", 3: "Passive", 4: "Stressful" }[Number(value) as 1 | 2 | 3 | 4] ?? "Not recorded");

export function HealthDashboard({ samples, daily, loading, onSelect }: { samples: HealthSample[]; daily: { date: string; steps?: number; kcal?: number }[]; loading: boolean; onSelect: (kind: HealthKind) => void }) {
  const nights = samples.filter((s) => s.kind === "sleep" && s.entry_data.IsNap !== true).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  const night = nights.at(-1), sleep = night?.entry_data ?? {};
  const latest = (kind: HealthKind) => samples.filter((s) => s.kind === kind).sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0];
  const recovery = latest("recovery"), activity = latest("activity"), day = daily.at(-1);
  const balance = percentage(recovery?.entry_data.Balance);
  const stages = [{ label: "Deep", value: sleepHours(sleep.DeepSleepDuration), color: "#a997ed" }, { label: "Light", value: sleepHours(sleep.LightSleepDuration), color: "#ddd1ff" }, { label: "REM", value: sleepHours(sleep.REMSleepDuration), color: "#6c68ab" }];
  const stageTotal = stages.reduce((sum, stage) => sum + (stage.value ?? 0), 0);
  let offset = 0;
  const trends = nights.slice(-14).map((s) => ({ date: dateLabel(sleepDate(s)), hours: sleepHours(s.entry_data.Duration), hrv: healthNumber(s.entry_data.AvgHRV) }));
  const durations = nights.map((s) => sleepHours(s.entry_data.Duration)).filter((v): v is number => v !== undefined);
  const average = durations.length ? durations.reduce((sum, n) => sum + n, 0) / durations.length : undefined;
  return <div className="health-dashboard" aria-busy={loading}>
    <div className="health-summary-grid">
      <Summary label="Latest overnight sleep" value={number(sleepHours(sleep.Duration), 1)} unit="hours" detail={dateLabel(night && sleepDate(night))} icon={Moon} color="lavender" onClick={() => onSelect("sleep")} />
      <Summary label="Daily movement" value={number(day?.steps)} unit="steps" detail={dateLabel(day?.date)} icon={Footprints} color="mint" onClick={() => onSelect("daily")} />
      <Summary label="Overnight HRV" value={number(healthNumber(sleep.AvgHRV), 1)} unit="ms" detail={dateLabel(night && sleepDate(night))} icon={Waves} color="peach" onClick={() => onSelect("sleep")} />
      <Summary label="Latest heart rate" value={number(healthNumber(activity?.entry_data.HR))} unit="bpm" detail={activity ? new Date(activity.recorded_at).toLocaleString("en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "No recorded data"} icon={HeartPulse} color="rose" onClick={() => onSelect("activity")} />
    </div>
    <div className="health-hero-grid">
      <section className="health-panel health-sleep-panel">
        <div className="health-panel-heading"><div><p className="health-eyebrow"><Moon size={13} /> A quieter night</p><h2>Your sleep, in focus.</h2></div><button type="button" className="health-link tap" onClick={() => onSelect("sleep")} aria-label="View sleep details"><ArrowUpRight size={19} /></button></div>
        <div className="health-sleep-body"><div className="health-sleep-ring"><svg viewBox="0 0 160 160" aria-label="Recorded sleep stages"><circle cx="80" cy="80" r="65" fill="none" stroke="var(--health-border)" strokeWidth="13" />{stageTotal > 0 && stages.map((stage) => { const length = (stage.value ?? 0) / stageTotal * 408.4; const start = offset; offset += length; return <circle key={stage.label} cx="80" cy="80" r="65" fill="none" stroke={stage.color} strokeWidth="13" strokeDasharray={`${Math.max(0, length - 3)} ${408.4 - Math.max(0, length - 3)}`} strokeDashoffset={-start} transform="rotate(-90 80 80)" />; })}</svg><div><BedDouble size={23} /><strong>{number(sleepHours(sleep.Duration), 1)}<small>h</small></strong><span>{dateLabel(night && sleepDate(night))}</span></div></div>
          <div className="health-stage-list">{stages.map((stage) => <div key={stage.label}><span className="health-stage-name"><i style={{ background: stage.color }} />{stage.label}</span><b>{number(stage.value, 1)} <small>h</small></b></div>)}<p className="health-muted">Recorded stages · naps in history</p></div>
        </div>
        <div className="health-sleep-times"><div><Moon size={16} /><span>Bedtime<b>{clock(sleep.BedtimeStart)}</b></span></div><span className="health-time-line" /><div><Sun size={16} /><span>Wake up<b>{clock(sleep.BedtimeEnd)}</b></span></div></div>
      </section>
      <section className="health-panel health-recovery-panel"><div className="health-panel-heading"><div><p className="health-eyebrow"><Sparkles size={13} /> Recovery snapshot</p><h2>Body resources</h2></div><button type="button" className="health-link tap" onClick={() => onSelect("recovery")} aria-label="View recovery details"><ArrowUpRight size={19} /></button></div><div className="health-resource-value">{number(balance)}<span>%</span></div><div className="health-resource-meter" role="meter" aria-label="Recorded body resources" aria-valuemin={0} aria-valuemax={100} aria-valuenow={balance}><span style={{ width: `${balance ?? 0}%` }} /></div><div className="health-resource-labels"><span>0%</span><span>100%</span></div><div className="health-recovery-footer"><span className="health-status-dot" /><span>{stress(recovery?.entry_data.StressState)}<small>{recovery ? new Date(recovery.recorded_at).toLocaleString("en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Sync to see your watch data"}</small></span></div><p className="health-muted">The latest measurement from your watch.</p></section>
    </div>
    <div className="health-trend-grid">
      <section className="health-panel"><div className="health-panel-heading"><div><p className="health-eyebrow">Night by night</p><h2>Sleep rhythm</h2></div><div className="health-chart-stat"><b>{number(average, 1)} <small>h</small></b><span>Average in this range</span></div></div><div className="health-chart">{trends.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={trends} margin={{ left: -20, right: 8, top: 15 }}><defs><linearGradient id="health-sleep-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b5a1ed" stopOpacity={.35} /><stop offset="100%" stopColor="#b5a1ed" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--health-border)" /><XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--dash-muted)" }} axisLine={false} tickLine={false} minTickGap={25} /><YAxis tick={{ fontSize: 10, fill: "var(--dash-muted)" }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltip} /><Area dataKey="hours" name="Sleep (h)" stroke="#b5a1ed" strokeWidth={2.5} fill="url(#health-sleep-fill)" connectNulls={false} /></AreaChart></ResponsiveContainer> : <Empty loading={loading} />}</div><p className="health-muted">Latest 14 recorded nights · Bangkok time</p></section>
      <section className="health-panel"><div className="health-panel-heading"><div><p className="health-eyebrow">Every step counts</p><h2>Daily movement</h2></div><Footprints size={22} className="health-mint" /></div><div className="health-chart">{daily.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={daily.slice(-14).map((d) => ({ ...d, label: dateLabel(d.date) }))} margin={{ left: -20, right: 8, top: 15 }}><CartesianGrid vertical={false} stroke="var(--health-border)" /><XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--dash-muted)" }} axisLine={false} tickLine={false} minTickGap={25} /><YAxis tick={{ fontSize: 10, fill: "var(--dash-muted)" }} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltip} /><Bar dataKey="steps" name="Steps" fill="#94c9b0" radius={[5, 5, 0, 0]} maxBarSize={25} /></BarChart></ResponsiveContainer> : <Empty loading={loading} />}</div><p className="health-muted">Latest 14 daily totals · one watch source</p></section>
    </div>
    <div className="health-data-note"><HeartPulse size={16} /><p>Your own rhythm, over time. Missing measurements stay blank; no scores or targets are estimated.</p></div>
  </div>;
}

function Summary({ label, value, unit, detail, icon: Icon, color, onClick }: { label: string; value: string; unit: string; detail: string; icon: typeof Moon; color: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`health-summary health-${color} tap`}><div className="health-summary-label"><span className="health-icon"><Icon size={18} /></span><ArrowUpRight size={15} /></div><p>{label}</p><strong>{value}<small>{unit}</small></strong><span className="health-summary-date">{detail}</span></button>;
}
function Empty({ loading }: { loading: boolean }) { return <div className="health-chart-empty">{loading ? "Loading your health history…" : "Your next sync will bring this chart to life."}</div>; }
