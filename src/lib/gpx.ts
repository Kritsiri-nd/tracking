import type { Activity, ActivityTrackPoint } from "./types";

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function distanceBetweenKm(first: ActivityTrackPoint, second: ActivityTrackPoint) {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const latitudeOne = toRadians(first.latitude);
  const latitudeTwo = toRadians(second.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitudeOne) * Math.cos(latitudeTwo) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function validTrackPoint(point: ActivityTrackPoint) {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) <= 90
    && Math.abs(point.longitude) <= 180;
}

/**
 * Remove only invalid coordinates and isolated GPS spikes.
 *
 * A runner can legitimately finish close to the starting point. The old
 * implementation removed every late point near the start, which shortened
 * closed-loop routes and made the final segment look misaligned on the map.
 */
function cleanActivityTrack(points: ActivityTrackPoint[]) {
  const validPoints = points.filter(validTrackPoint);
  if (validPoints.length < 3) return validPoints;

  const cleaned = validPoints.filter((point, index) => {
    if (index === 0 || index === validPoints.length - 1) return true;

    const previous = validPoints[index - 1];
    const next = validPoints[index + 1];
    const previousToPoint = distanceBetweenKm(previous, point);
    const pointToNext = distanceBetweenKm(point, next);
    const previousToNext = distanceBetweenKm(previous, next);

    // A single sample that jumps away and immediately returns is a GPS spike.
    // The endpoint is never removed, so a real return to the start stays intact.
    return !(previousToPoint > 0.35 && pointToNext > 0.35 && previousToNext < 0.35);
  });

  return cleaned.length >= 2 ? cleaned : validPoints;
}

/** Keep a detailed but database-friendly route while preserving both endpoints. */
export function sampleActivityTrack(points: ActivityTrackPoint[], maxPoints = 360) {
  if (points.length <= maxPoints) return points;
  const sampled = Array.from({ length: maxPoints }, (_, index) => {
    const sourceIndex = Math.round(index * (points.length - 1) / (maxPoints - 1));
    return points[sourceIndex];
  });
  return sampled.filter((point, index) => index === 0 || point !== sampled[index - 1]);
}

export function getActivityTrack(activity: Activity): ActivityTrackPoint[] {
  const rawPoints = activity.track?.length ? activity.track : activity.stream.flatMap((point) => {
    if (typeof point.latitude !== "number" || typeof point.longitude !== "number") return [];
    return [{ distanceKm: point.distanceKm, latitude: point.latitude, longitude: point.longitude, elevationM: point.elevationM, timestamp: point.timestamp }];
  });
  return cleanActivityTrack(rawPoints);
}

export function activityToGpx(activity: Activity) {
  const points = getActivityTrack(activity);
  if (points.length < 2) throw new Error("This activity does not contain enough GPS points to export a GPX route.");
  const trackPoints = points.map((point) => {
    const elevation = point.elevationM === undefined ? "" : `<ele>${point.elevationM.toFixed(1)}</ele>`;
    const time = point.timestamp ? `<time>${escapeXml(point.timestamp)}</time>` : "";
    return `<trkpt lat="${point.latitude.toFixed(7)}" lon="${point.longitude.toFixed(7)}">${elevation}${time}</trkpt>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Stridebook" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata><name>${escapeXml(activity.title)}</name><time>${escapeXml(activity.startedAt)}</time></metadata>
  <trk><name>${escapeXml(activity.title)}</name><type>running</type><trkseg>${trackPoints}</trkseg></trk>
</gpx>`;
}
