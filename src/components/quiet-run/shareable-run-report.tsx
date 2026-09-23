"use client";

import { Check, Copy, Download, Share2, X } from "lucide-react";
import { useState } from "react";
import { downloadRunReport, runReportSummary, shareRunReport } from "@/lib/run-report";
import type { Activity } from "@/lib/types";
import { GlassCard, cn } from "./shared";

export function ShareableRunReport({ activity, startedAtLabel }: { activity: Activity; startedAtLabel: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string>();

  async function handleDownload() {
    setBusy(true);
    setFeedback(undefined);
    try {
      await downloadRunReport(activity, startedAtLabel);
      setFeedback("Report downloaded.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not create the report.");
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    setBusy(true);
    setFeedback(undefined);
    try {
      const result = await shareRunReport(activity, startedAtLabel);
      setFeedback(result === "copied" ? "Summary copied to clipboard." : "Share sheet opened.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFeedback(error instanceof Error ? error.message : "Could not share the report.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopySummary() {
    setBusy(true);
    setFeedback(undefined);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard is not available in this browser.");
      await navigator.clipboard.writeText(runReportSummary(activity, startedAtLabel));
      setFeedback("Summary copied to clipboard.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not copy the summary.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setFeedback(undefined); }} className="tap inline-flex items-center gap-2 rounded-full border border-[#a6ff00]/30 bg-[#a6ff00]/10 px-4 py-2 text-sm font-semibold text-[#a6ff00] transition hover:bg-[#a6ff00]/20"><Share2 size={16} />Share report</button>
      {open && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#293029]/35 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <GlassCard className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-b-none rounded-t-[28px] p-5 sm:rounded-[28px] sm:p-6" role="dialog" aria-modal="true" aria-label="Shareable run report">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#85887f]">Shareable run report</p><h2 className="mt-1 text-2xl font-medium tracking-[-.045em]">Share this run</h2><p className="mt-1 text-sm text-[#777b73]">A clean summary card made from this activity.</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close shareable run report" title="Close shareable run report" className="tap grid size-10 place-items-center rounded-2xl bg-white/55"><X size={18} /></button></div>
          <div className="mt-5 overflow-hidden rounded-[26px] bg-[#151815] p-5 text-white shadow-[0_20px_55px_rgba(0,0,0,.22)] sm:p-6"><div className="flex items-start justify-between gap-4"><div><div className="text-xs font-bold uppercase tracking-[.24em] text-[#a6ff00]">Stridebook</div><div className="mt-1 text-[10px] uppercase tracking-[.18em] text-[#9ca197]">Run report</div></div><div className="rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-semibold text-[#c8d0c3]">{activity.type}</div></div><h3 className="mt-7 truncate text-2xl font-semibold tracking-[-.04em]">{activity.title}</h3><p className="mt-1 truncate text-xs text-[#9ca197]">{startedAtLabel}</p><div className="mt-6 grid grid-cols-2 gap-2"><ReportMetric label="Distance" value={`${activity.distanceKm.toFixed(2)} km`} accent /><ReportMetric label="Time" value={formatReportDuration(activity.durationSec)} /><ReportMetric label="Avg pace" value={`${formatReportPace(activity.paceSecPerKm)} /km`} /><ReportMetric label="Avg HR" value={`${activity.avgHr?.toFixed(0) ?? "—"} bpm`} /></div><div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-xs"><ReportSmallMetric label="Max HR" value={`${activity.maxHr?.toFixed(0) ?? "—"} bpm`} /><ReportSmallMetric label="Cadence" value={`${formatReportCadence(activity.avgCadence)} steps/s`} /><ReportSmallMetric label="Elevation" value={`${activity.elevationGainM?.toFixed(0) ?? "—"} m`} /></div><div className="mt-6 h-1.5 w-20 rounded-full bg-[#a6ff00]" /></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" disabled={busy} onClick={() => void handleShare()} className={cn("tap inline-flex items-center justify-center gap-2 rounded-2xl bg-[#343b34] px-4 py-3 text-sm font-semibold text-white", busy && "cursor-wait opacity-60")}><Share2 size={16} />Share</button><button type="button" disabled={busy} onClick={() => void handleDownload()} className={cn("tap inline-flex items-center justify-center gap-2 rounded-2xl border border-[#343b34]/12 bg-white/45 px-4 py-3 text-sm font-semibold", busy && "cursor-wait opacity-60")}><Download size={16} />Download PNG</button></div>
          <button type="button" disabled={busy} onClick={() => void handleCopySummary()} className="tap mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#343b34]/10 bg-white/30 px-4 py-2.5 text-xs font-semibold text-[#687066] disabled:opacity-60"><Copy size={14} />Copy summary text</button>
          {feedback && <p role="status" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#53644e]"><Check size={14} />{feedback}</p>}
        </GlassCard>
      </div>}
    </>
  );
}

function formatReportDuration(seconds: number) {
  const totalMinutes = Math.max(0, Math.floor(seconds / 60));
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

function formatReportPace(seconds: number) {
  if (!seconds || !Number.isFinite(seconds)) return "—";
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

function formatReportCadence(cadence?: number) {
  return cadence === undefined || !Number.isFinite(cadence) ? "—" : (cadence / 60).toFixed(1);
}

function ReportMetric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className="rounded-2xl bg-white/7 p-3"><div className="text-[10px] uppercase tracking-[.15em] text-[#9ca197]">{label}</div><div className={cn("mt-2 text-xl font-semibold tracking-[-.04em]", accent ? "text-[#a6ff00]" : "text-white")}>{value}</div></div>;
}

function ReportSmallMetric({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] uppercase tracking-[.12em] text-[#9ca197]">{label}</div><div className="mt-1 font-semibold text-[#f2f4ee]">{value}</div></div>;
}
