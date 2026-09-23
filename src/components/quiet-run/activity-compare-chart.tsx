"use client";

import { Activity as ActivityIcon, Check, Gauge, HeartPulse, Mountain, Satellite, SlidersHorizontal, Thermometer } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import type { Activity } from "@/lib/types";
import { GlassCard, cn } from "./shared";

type CompareMetric = "pace" | "heartRate" | "cadence" | "elevation" | "speed" | "temperature";

type MetricDefinition = {
  id: CompareMetric;
  label: string;
  unit: string;
  color: string;
  icon: LucideIcon;
  format: (value: number) => string;
};

const metricDefinitions: MetricDefinition[] = [
  { id: "pace", label: "Pace", unit: "min/km", color: "#bd755c", icon: Gauge, format: (value) => `${Math.floor(value)}:${String(Math.round((value % 1) * 60)).padStart(2, "0")} /km` },
  { id: "heartRate", label: "Heart rate", unit: "bpm", color: "#7f9277", icon: HeartPulse, format: (value) => `${Math.round(value)} bpm` },
  { id: "cadence", label: "Cadence", unit: "steps/s", color: "#756e8e", icon: ActivityIcon, format: (value) => `${value.toFixed(1)} steps/s` },
  { id: "elevation", label: "Elevation", unit: "m", color: "#c29a51", icon: Mountain, format: (value) => `${Math.round(value)} m` },
  { id: "speed", label: "Speed", unit: "km/h", color: "#4f8b91", icon: Satellite, format: (value) => `${value.toFixed(1)} km/h` },
  { id: "temperature", label: "Temperature", unit: "°C", color: "#a75b55", icon: Thermometer, format: (value) => `${value.toFixed(1)} °C` },
];

type ChartPoint = { elapsedSec: number; value: number };

function elapsedSeconds(timestamp: string | undefined, firstTimestamp: number | undefined, fallback: number, durationSec: number) {
  if (timestamp && firstTimestamp !== undefined) {
    const currentTimestamp = Date.parse(timestamp);
    if (Number.isFinite(currentTimestamp)) return Math.max(0, Math.min(durationSec, (currentTimestamp - firstTimestamp) / 1000));
  }
  return Math.max(0, Math.min(durationSec, fallback));
}

function sampleMetricValue(metric: CompareMetric, sample: Activity["stream"][number]) {
  if (metric === "pace") return sample.paceSecPerKm && sample.paceSecPerKm > 0 ? sample.paceSecPerKm / 60 : undefined;
  if (metric === "heartRate") return sample.heartRate;
  if (metric === "cadence") return sample.cadence === undefined ? undefined : sample.cadence / 60;
  if (metric === "elevation") return sample.elevationM;
  if (metric === "temperature") return sample.temperatureC;
  if (sample.paceSecPerKm === undefined || sample.paceSecPerKm <= 0) return undefined;
  return 3600 / sample.paceSecPerKm;
}

function getMetricSeries(activity: Activity, metric: CompareMetric): ChartPoint[] {
  const samples = activity.stream ?? [];
  const timestamps = samples.map((sample) => sample.timestamp ? Date.parse(sample.timestamp) : NaN).filter(Number.isFinite);
  const firstTimestamp = timestamps.length ? timestamps[0] : undefined;
  const points = samples.flatMap((sample, index) => {
    const value = sampleMetricValue(metric, sample);
    if (value === undefined || !Number.isFinite(value)) return [];
    const fallback = activity.distanceKm > 0 ? (sample.distanceKm / activity.distanceKm) * activity.durationSec : (index / Math.max(1, samples.length - 1)) * activity.durationSec;
    return [{ elapsedSec: elapsedSeconds(sample.timestamp, firstTimestamp, fallback, activity.durationSec), value }];
  });

  if (points.length > 1) return points;
  const summaryValue = metric === "pace" ? activity.paceSecPerKm / 60 : metric === "heartRate" ? activity.avgHr : metric === "cadence" && activity.avgCadence !== undefined ? activity.avgCadence / 60 : metric === "speed" && activity.paceSecPerKm > 0 ? 3600 / activity.paceSecPerKm : undefined;
  return summaryValue !== undefined && Number.isFinite(summaryValue) ? [{ elapsedSec: 0, value: summaryValue }, { elapsedSec: activity.durationSec, value: summaryValue }] : points;
}

function hasMetricData(activity: Activity, metric: CompareMetric) {
  return getMetricSeries(activity, metric).length > 0;
}

function formatElapsedTime(seconds: number) {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Overlay two FIT signals on one elapsed-time timeline with independent Y axes. */
export function ActivityCompareChart({ activity }: { activity: Activity }) {
  const [selectedMetrics, setSelectedMetrics] = useState<CompareMetric[]>(["pace", "heartRate"]);
  const chartRef = useRef<HTMLDivElement>(null);
  const availableMetrics = useMemo(() => metricDefinitions.filter((metric) => hasMetricData(activity, metric.id)), [activity]);
  const selectedDefinitions = useMemo(() => selectedMetrics.map((metric) => metricDefinitions.find((definition) => definition.id === metric)).filter((definition): definition is MetricDefinition => Boolean(definition)), [selectedMetrics]);
  const selectedSeries = useMemo(() => selectedDefinitions.map((metric) => ({ metric, points: getMetricSeries(activity, metric.id) })), [activity, selectedDefinitions]);

  function toggleMetric(metric: CompareMetric) {
    setSelectedMetrics((current) => {
      if (current.includes(metric)) return current.length > 1 ? current.filter((item) => item !== metric) : current;
      return current.length < 2 ? [...current, metric] : current;
    });
  }

  useEffect(() => {
    if (!chartRef.current) return undefined;
    const chart = echarts.init(chartRef.current);
    const yAxes = selectedDefinitions.map((metric, index) => ({
      type: "value" as const,
      name: metric.unit,
      nameTextStyle: { color: "#858880", fontSize: 11 },
      position: index === 0 ? "left" as const : "right" as const,
      axisLine: { show: true, lineStyle: { color: metric.color, width: 1.5 } },
      axisTick: { show: false },
      axisLabel: { color: "#858880", fontSize: 11, formatter: (value: number) => metric.id === "pace" ? `${Math.floor(value)}:${String(Math.round((value % 1) * 60)).padStart(2, "0")}` : metric.id === "cadence" || metric.id === "speed" || metric.id === "temperature" ? value.toFixed(1) : String(Math.round(value)) },
      splitLine: index === 0 ? { show: true, lineStyle: { color: "rgba(52, 59, 52, .08)", type: "dashed" as const } } : { show: false },
      inverse: metric.id === "pace",
    }));
    const series = selectedSeries.map(({ metric, points }, index) => ({
      name: metric.label,
      type: "line" as const,
      yAxisIndex: index,
      data: points.map((point) => [point.elapsedSec, point.value]),
      connectNulls: true,
      smooth: true,
      showSymbol: false,
      symbol: "circle",
      lineStyle: { width: 3, color: metric.color },
      itemStyle: { color: metric.color },
      emphasis: { focus: "series" as const },
      tooltip: { valueFormatter: (value: unknown) => typeof value === "number" ? metric.format(value) : "—" },
    }));

    chart.setOption({
      animationDuration: 450,
      animationDurationUpdate: 300,
      backgroundColor: "transparent",
      grid: { left: 58, right: 64, top: 42, bottom: 36, containLabel: true },
      xAxis: { type: "value", min: 0, max: Math.max(1, activity.durationSec), boundaryGap: false, name: "Elapsed time", nameLocation: "middle", nameGap: 28, nameTextStyle: { color: "#858880", fontSize: 11 }, axisLine: { lineStyle: { color: "rgba(52, 59, 52, .16)" } }, axisTick: { show: false }, axisLabel: { color: "#858880", fontSize: 11, formatter: (value: number) => formatElapsedTime(value) } },
      yAxis: yAxes,
      legend: { show: false },
      tooltip: { trigger: "axis", axisPointer: { type: "cross", snap: true }, backgroundColor: "#fffdf8", borderColor: "rgba(67,70,64,.12)", borderWidth: 1, textStyle: { color: "#30342f", fontSize: 12 }, extraCssText: "box-shadow: 0 12px 30px rgba(52,59,52,.12); border-radius: 14px;" },
      series,
    });

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(chartRef.current);
    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, [activity, selectedDefinitions, selectedSeries]);

  return (
    <GlassCard className="overflow-hidden p-0">
      <div className="bg-gradient-to-br from-[#f5f0e5] via-[#fbfaf5] to-[#eef1e8] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#343b34] text-white"><ActivityIcon size={20} /></div>
            <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#85887f]">Compare metrics</p><h2 className="mt-1 text-xl font-medium tracking-[-.025em]">Compare two signals</h2><p className="mt-1 max-w-xl text-sm text-[#777b73]">Overlay two FIT signals on the same elapsed-time timeline.</p></div>
          </div>
          <span className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#5f685d]">{selectedMetrics.length} / 2 selected</span>
        </div>

        <div className="mt-5 rounded-3xl border border-white/80 bg-white/55 p-3 sm:p-4">
          <div className="flex items-center gap-2"><SlidersHorizontal size={16} className="text-[#687466]" /><span className="text-sm font-semibold">Metrics</span><span className="text-xs text-[#858880]">Choose up to two</span></div>
          <div className="mt-3 flex flex-wrap gap-2">
            {metricDefinitions.map((metric) => {
              const Icon = metric.icon;
              const selected = selectedMetrics.includes(metric.id);
              const unavailable = !availableMetrics.some((item) => item.id === metric.id);
              const locked = !selected && selectedMetrics.length >= 2;
              return <button key={metric.id} type="button" aria-pressed={selected} disabled={unavailable || locked} title={unavailable ? `${metric.label} is not available in this FIT file` : locked ? "Remove a metric before selecting another" : undefined} onClick={() => toggleMetric(metric.id)} className={cn("tap inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition", selected ? "border-[#343b34] bg-[#343b34] text-white shadow-sm" : "border-[#343b34]/8 bg-white/70 text-[#656c63] hover:border-[#7f9277]/40 hover:bg-white", (unavailable || locked) && "cursor-not-allowed opacity-35")}>{selected ? <Check size={14} /> : <Icon size={14} style={{ color: metric.color }} />}{metric.label}<span className={cn("font-normal", selected ? "text-white/65" : "text-[#969a91]")}>{metric.unit}</span></button>;
            })}
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#85887f]">Over-time comparison</p><h3 className="mt-1 text-lg font-medium">Independent left and right axes</h3><p className="mt-1 text-xs text-[#858880]">Each signal keeps its own unit across the elapsed-time timeline.</p></div><div className="flex flex-wrap gap-3 text-xs font-semibold text-[#777b73]">{selectedDefinitions.map((metric, index) => <span key={metric.id} className="inline-flex items-center gap-2"><i className="size-2.5 rounded-full" style={{ backgroundColor: metric.color }} />{index === 0 ? "Left" : "Right"}: {metric.label}</span>)}</div></div>
        <div ref={chartRef} className="mt-5 h-[340px] rounded-3xl border border-[#343b34]/8 bg-[#fbfaf5]" aria-label="Two metric comparison chart" />
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-[#f1f3ec] px-4 py-3 text-xs text-[#687466]"><span className="size-2 rounded-full bg-[#7f9277]" />{selectedMetrics.length === 1 ? "Select one more metric to compare it with the current signal." : "Both axes are independent so pace and heart rate stay readable."}</div>
      </div>
    </GlassCard>
  );
}
