import { activityToGpx } from "./gpx";
import type { Activity } from "./types";

/** Quote text safely for spreadsheet readers and preserve Thai characters. */
function csvCell(value: string | number | undefined) {
  const text = String(value ?? "");
  const safeText = typeof value === "string" && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function activitiesToCsv(activities: Activity[]) {
  const rows: Array<Array<string | number | undefined>> = [
    ["Date", "Started at", "Title", "Type", "Source", "Distance (km)", "Duration (seconds)", "Pace (seconds/km)", "Average HR (bpm)", "Elevation gain (m)", "RPE", "Notes"],
    ...activities.map((activity) => [activity.date, activity.startedAt, activity.title, activity.type, activity.source, activity.distanceKm, activity.durationSec, activity.paceSecPerKm, activity.avgHr, activity.elevationGainM, activity.rpe, activity.note]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** Export the currently visible history so search and filters apply to the download. */
export function downloadActivitiesCsv(activities: Activity[]) {
  const url = URL.createObjectURL(new Blob([activitiesToCsv(activities)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "stridebook-activities.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Download a parsed activity as a standard GPX file. */
export function downloadGpx(activity: Activity) {
  const blob = new Blob([activityToGpx(activity)], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${activity.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "stridebook"}.gpx`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
