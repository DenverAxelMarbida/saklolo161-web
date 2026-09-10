// Straight-line distance/ETA helpers. The backend's GET /api/routes
// degrades to a straight line at ~40 km/h (routingService.js fallback);
// these mirror it so the dashboard can show an INSTANT provisional
// distance/ETA while the real routed metrics are still in flight, then
// swap in the real numbers when they arrive.

export const FALLBACK_SPEED_KMH = 40;

const EARTH_RADIUS_METERS = 6371000;

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

// Great-circle distance between two lat/lng points in meters (haversine).
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Provisional distance/ETA in the backend fallback's exact shape.
export function straightLineEstimate(lat1, lng1, lat2, lng2) {
  const distanceMeters = Math.round(haversineMeters(lat1, lng1, lat2, lng2));
  const durationSeconds = Math.round(distanceMeters / (FALLBACK_SPEED_KMH * 1000 * (1 / 3600)));
  return { distanceMeters, durationSeconds };
}