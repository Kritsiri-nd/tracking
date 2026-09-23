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

/** Remove repeated start-position GPS samples that create false spikes in the route. */
function cleanActivityTrack(points: ActivityTrackPoint[]) {
  if (points.length < 3) return points;
  const origin = points[0];
  const originDistanceKm = origin.distanceKm ?? 0;
  const cleaned = points.filter((point, index) => {
    const isInteriorPoint = index > 0 && index < points.length - 1;
    const isRepeatedStartPosition = isInteriorPoint && (point.distanceKm ?? 0) > originDistanceKm + 0.5 && distanceBetweenKm(origin, point) < 0.25;
    return !isRepeatedStartPosition;
  });
  return cleaned.length >= 2 ? cleaned : points;
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
