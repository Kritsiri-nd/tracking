import { formatCadencePerSecond, formatDuration, formatPace } from "./progress";
import type { Activity } from "./types";

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '\"': "&quot;" })[character] ?? character);
}

function reportFileName(activity: Activity) {
  return `${activity.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "run"}-stridebook-report`;
}

export function runReportSummary(activity: Activity, startedAtLabel: string) {
  return `${activity.title} · ${startedAtLabel} · ${activity.distanceKm.toFixed(2)} km · ${formatDuration(activity.durationSec)} · ${formatPace(activity.paceSecPerKm)}/km · Avg HR ${activity.avgHr?.toFixed(0) ?? "—"} bpm`;
}

/** Create a self-contained dark report card that can be rendered as a PNG. */
export function createRunReportSvg(activity: Activity, startedAtLabel: string) {
  const title = escapeXml(activity.title);
  const date = escapeXml(startedAtLabel);
  const source = escapeXml(`${activity.source} · ${activity.type}`);
  const distance = `${activity.distanceKm.toFixed(2)} km`;
  const duration = formatDuration(activity.durationSec);
  const pace = `${formatPace(activity.paceSecPerKm)} /km`;
  const avgHr = `${activity.avgHr?.toFixed(0) ?? "—"} bpm`;
  const maxHr = `${activity.maxHr?.toFixed(0) ?? "—"} bpm`;
  const cadence = `${formatCadencePerSecond(activity.avgCadence)} steps/s`;
  const elevation = `${activity.elevationGainM?.toFixed(0) ?? "—"} m`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#202620"/><stop offset="1" stop-color="#101310"/></linearGradient><linearGradient id="lime" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a6ff00"/><stop offset="1" stop-color="#d0ff72"/></linearGradient></defs>
  <rect width="1080" height="1350" rx="56" fill="url(#bg)"/>
  <circle cx="910" cy="120" r="190" fill="#a6ff00" opacity=".08"/><circle cx="130" cy="1230" r="240" fill="#7f9277" opacity=".12"/>
  <text x="84" y="104" fill="#a6ff00" font-family="Arial, sans-serif" font-size="25" font-weight="700" letter-spacing="6">STRIDEBOOK</text>
  <text x="84" y="158" fill="#9ca197" font-family="Arial, sans-serif" font-size="20" letter-spacing="3">RUN REPORT</text>
  <text x="84" y="252" fill="#f2f4ee" font-family="Arial, sans-serif" font-size="54" font-weight="700">${title}</text>
  <text x="84" y="300" fill="#9ca197" font-family="Arial, sans-serif" font-size="23">${date}</text>
  <text x="84" y="342" fill="#9ca197" font-family="Arial, sans-serif" font-size="21">${source}</text>
  <rect x="72" y="406" width="936" height="250" rx="34" fill="#ffffff" opacity=".06" stroke="#ffffff" stroke-opacity=".12"/>
  <text x="110" y="482" fill="#9ca197" font-family="Arial, sans-serif" font-size="19" letter-spacing="2">DISTANCE</text><text x="110" y="565" fill="url(#lime)" font-family="Arial, sans-serif" font-size="76" font-weight="700">${distance}</text>
  <text x="560" y="482" fill="#9ca197" font-family="Arial, sans-serif" font-size="19" letter-spacing="2">TIME</text><text x="560" y="565" fill="#f2f4ee" font-family="Arial, sans-serif" font-size="76" font-weight="700">${duration}</text>
  <text x="110" y="760" fill="#9ca197" font-family="Arial, sans-serif" font-size="19" letter-spacing="2">AVG PACE</text><text x="110" y="824" fill="#f2f4ee" font-family="Arial, sans-serif" font-size="48" font-weight="700">${pace}</text>
  <text x="560" y="760" fill="#9ca197" font-family="Arial, sans-serif" font-size="19" letter-spacing="2">AVG HEART RATE</text><text x="560" y="824" fill="#f2f4ee" font-family="Arial, sans-serif" font-size="48" font-weight="700">${avgHr}</text>
  <line x1="84" y1="900" x2="996" y2="900" stroke="#ffffff" stroke-opacity=".12"/>
  <text x="84" y="970" fill="#9ca197" font-family="Arial, sans-serif" font-size="19" letter-spacing="2">MAX HR</text><text x="84" y="1024" fill="#f2f4ee" font-family="Arial, sans-serif" font-size="32" font-weight="700">${maxHr}</text>
  <text x="370" y="970" fill="#9ca197" font-family="Arial, sans-serif" font-size="19" letter-spacing="2">CADENCE</text><text x="370" y="1024" fill="#f2f4ee" font-family="Arial, sans-serif" font-size="32" font-weight="700">${cadence}</text>
  <text x="700" y="970" fill="#9ca197" font-family="Arial, sans-serif" font-size="19" letter-spacing="2">ELEVATION</text><text x="700" y="1024" fill="#f2f4ee" font-family="Arial, sans-serif" font-size="32" font-weight="700">${elevation}</text>
  <rect x="84" y="1170" width="180" height="8" rx="4" fill="url(#lime)"/><text x="84" y="1240" fill="#9ca197" font-family="Arial, sans-serif" font-size="20">Keep moving.</text>
  </svg>`;
}

async function renderReportPng(activity: Activity, startedAtLabel: string) {
  const svgBlob = new Blob([createRunReportSvg(activity, startedAtLabel)], { type: "image/svg+xml" });
  const svgUrl = URL.createObjectURL(svgBlob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = svgUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not render the run report."));
    });
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    canvas.getContext("2d")?.drawImage(image, 0, 0);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) throw new Error("Could not create the run report image.");
    return png;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export async function downloadRunReport(activity: Activity, startedAtLabel: string) {
  const png = await renderReportPng(activity, startedAtLabel);
  const url = URL.createObjectURL(png);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${reportFileName(activity)}.png`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function shareRunReport(activity: Activity, startedAtLabel: string) {
  const summary = runReportSummary(activity, startedAtLabel);
  let png: Blob | undefined;
  try {
    png = await renderReportPng(activity, startedAtLabel);
  } catch {
    png = undefined;
  }
  const file = png ? new File([png], `${reportFileName(activity)}.png`, { type: "image/png" }) : undefined;
  if (navigator.share) {
    const canShareFile = file && navigator.canShare?.({ files: [file] });
    await navigator.share(canShareFile ? { title: `${activity.title} · Stridebook`, text: summary, files: [file] } : { title: `${activity.title} · Stridebook`, text: summary });
    return "shared" as const;
  }
  if (!navigator.clipboard?.writeText) throw new Error("Sharing is not available in this browser.");
  await navigator.clipboard.writeText(summary);
  return "copied" as const;
}
