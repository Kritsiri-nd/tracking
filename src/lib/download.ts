import { activityToGpx } from "./gpx";
import type { Activity } from "./types";

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
